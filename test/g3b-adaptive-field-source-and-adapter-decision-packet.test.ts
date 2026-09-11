import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

type Packet = typeof import('../experiments/praetor_verify_001/g3b/G3B_ADAPTIVE_FIELD_SOURCE_AND_ADAPTER_DECISION_PACKET.json');
type Design = typeof import('../experiments/praetor_verify_001/g3b/G3B_ADAPTIVE_INPUT_IMPLEMENTATION_DESIGN_REVIEW.json');
const root = new URL('../', import.meta.url);
const packet = JSON.parse(readFileSync(new URL('experiments/praetor_verify_001/g3b/G3B_ADAPTIVE_FIELD_SOURCE_AND_ADAPTER_DECISION_PACKET.json', root), 'utf8')) as Packet;
const design = JSON.parse(readFileSync(new URL(packet.source_basis.implementation_design.path, root), 'utf8')) as Design;

const valueAt = (document: unknown, path: string): unknown => path.split('/').slice(1).reduce<unknown>((value, key) => {
  if (value === null || typeof value !== 'object') return undefined;
  return (value as Record<string, unknown>)[key];
}, document);

const replaceAt = (document: unknown, path: string, value: unknown) => {
  const parts = path.split('/');
  const key = parts.pop()!;
  const parent = valueAt(document, parts.join('/')) as Record<string, unknown>;
  parent[key] = value;
};

const mirrorsAgree = (document: unknown) => packet.authority_derivation_contract.non_authoritative_mirrors.every(
  mirror => valueAt(document, mirror.path) === valueAt(document, mirror.canonical)
);

const decisionsConsistent = (document: unknown): boolean => {
  const entries = valueAt(document, '/required_human_decisions') as Packet['required_human_decisions'];
  if (!Array.isArray(entries) || entries.length !== packet.required_human_decisions.length) return false;
  if (new Set(entries.map(entry => entry.id)).size !== entries.length) return false;
  for (const expected of packet.required_human_decisions) {
    const entry = entries.find(candidate => candidate.id === expected.id);
    if (!entry || entry.policy_ref !== expected.policy_ref || entry.detail_ref !== expected.detail_ref) return false;
    const decision: unknown = entry.decision;
    if (decision !== null && !packet.consistency_contract.canonical_per_decision_domain.includes(decision as string)) return false;
    if (valueAt(document, `${entry.policy_ref}/human_decision`) !== decision) return false;
    if (entry.detail_ref && valueAt(document, `${entry.detail_ref}/human_decision`) !== decision) return false;
    const specialized = packet.consistency_contract.specialized_choices.find(choice => choice.decision_id === entry.id);
    if (specialized) {
      const selected = valueAt(document, specialized.choice_path);
      if (decision === 'APPROVE') {
        if (!specialized.approve_choices.includes(selected as string)) return false;
      } else if (decision === 'LEAVE_UNRESOLVED') {
        if (selected !== null && !(selected === 'LEAVE_UNRESOLVED' && entry.id !== 'adapter_option')) return false;
      } else if (selected !== null) return false;
    }
  }
  return valueAt(document, '/decision_model/stage_1/decision') !== 'APPROVE'
    || entries.every(entry => (entry.decision as unknown) === 'APPROVE');
};

const evaluateRules = (facts: Record<string, unknown>) => {
  const rules: Record<string, { all_of: string[] }> = packet.authority_derivation_contract.rules;
  const evaluate = (name: string): boolean => name in rules
    ? rules[name].all_of.every(evaluate)
    : facts[name] === true;
  return Object.fromEntries(Object.keys(rules).map(name => [name, evaluate(name)]));
};

describe('G3B field source and adapter human decision surface', () => {
  it('keeps effective authority out of writable packet fields and distinguishes presence from validity', () => {
    expect(packet.authority_derivation_contract.canonical_locations).toEqual({
      stage_1: '/decision_model/stage_1', stage_2: '/decision_model/stage_2',
      adapter_selection: '/adapter_decision/selected_adapter', per_decision: '/required_human_decisions'
    });
    expect(packet.decision_model.stage_1).not.toHaveProperty('current_source_instantiation_authorized');
    expect(packet.decision_model.stage_2).not.toHaveProperty('current_candidate_semantic_values_resolved');
    expect(packet.decision_model.stage_2).not.toHaveProperty('current_payload_construction_authorized');
    expect(mirrorsAgree(packet)).toBe(true);
    expect(decisionsConsistent(packet)).toBe(true);
    const pending = evaluateRules({});
    expect(Object.values(pending).every(value => value === false)).toBe(true);
    const forged = evaluateRules({
      current_source_instantiation_authorized: true, current_candidate_semantic_values_resolved: true,
      current_payload_construction_authorized: true, effective_stage_1_source_instantiation_authorized: true,
      effective_stage_2_candidate_semantic_values_resolved: true, stage_1_authority_chain_valid: true
    });
    expect(forged).toEqual(pending);
    const signatureOnly = evaluateRules({ stage_1_explicit_approve: true, stage_1_signature_present: true, stage_1_date_present: true });
    expect(signatureOnly.stage_1_human_decision_present).toBe(true);
    expect(signatureOnly.stage_1_authority_chain_valid).toBe(false);
    expect(signatureOnly.effective_stage_1_source_instantiation_authorized).toBe(false);
  });

  it('pins all six authority expressions rather than trusting an altered rule graph', () => {
    expect(packet.authority_derivation_contract.rules).toEqual({
      stage_1_human_decision_present: { all_of: ['stage_1_explicit_approve', 'stage_1_signature_present', 'stage_1_date_present'] },
      stage_1_authority_chain_valid: { all_of: ['all_14_required_decisions_approved', 'representations_consistent', 'stage_1_scope_exact', 'stage_1_design_complete', 'packet_integrity_references_valid'] },
      effective_stage_1_source_instantiation_authorized: { all_of: ['stage_1_human_decision_present', 'stage_1_authority_chain_valid'] },
      stage_2_human_decision_present: { all_of: ['stage_2_explicit_approve', 'stage_2_signature_present', 'stage_2_date_present'] },
      stage_2_authority_chain_valid: { all_of: ['effective_stage_1_source_instantiation_authorized', 'representations_consistent', 'packet_integrity_references_valid', 'stage_2_review_contract_passes', 'all_stage_2_matches', 'reviewed_sources_unchanged'] },
      effective_stage_2_candidate_semantic_values_resolved: { all_of: ['stage_2_human_decision_present', 'stage_2_authority_chain_valid'] }
    });
    const approvedReviewFacts = Object.fromEntries(Object.keys(packet.authority_derivation_contract.predicate_contracts).map(name => [name, true]));
    expect(Object.values(evaluateRules(approvedReviewFacts)).every(Boolean)).toBe(true);
    const chainWithoutSignature = evaluateRules({ ...approvedReviewFacts, stage_1_signature_present: false });
    expect(chainWithoutSignature.stage_1_authority_chain_valid).toBe(true);
    expect(chainWithoutSignature.stage_1_human_decision_present).toBe(false);
    expect(chainWithoutSignature.effective_stage_1_source_instantiation_authorized).toBe(false);
  });

  it.each(Object.keys(packet.authority_derivation_contract.predicate_contracts))('fails closed when %s is absent, false or not Boolean', predicate => {
    const abstractReviewFacts: Record<string, unknown> = Object.fromEntries(Object.keys(packet.authority_derivation_contract.predicate_contracts).map(name => [name, true]));
    for (const invalid of [false, undefined, null, 'true', 1]) {
      const result = evaluateRules({ ...abstractReviewFacts, [predicate]: invalid });
      expect(result.effective_stage_2_candidate_semantic_values_resolved).toBe(false);
      if (!predicate.startsWith('stage_2_') && !['all_stage_2_matches', 'reviewed_sources_unchanged'].includes(predicate)) {
        expect(result.effective_stage_1_source_instantiation_authorized).toBe(false);
      }
    }
  });

  it.each(packet.authority_derivation_contract.non_authoritative_mirrors)('blocks divergence of non-authoritative mirror $path', mirror => {
    const changed = structuredClone(packet);
    replaceAt(changed, mirror.path, 'TEST_ONLY_DIVERGENCE');
    expect(mirrorsAgree(changed)).toBe(false);
    expect(packet.authority_derivation_contract.mirror_rule).toContain('BLOCK_DECISION_ACTIVATION');
  });

  it.each(packet.required_human_decisions)('blocks inconsistent or partial approval for $id', expected => {
    const changed = structuredClone(packet);
    const index = packet.required_human_decisions.findIndex(entry => entry.id === expected.id);
    replaceAt(changed, `/required_human_decisions/${index}/decision`, 'REJECT');
    expect(decisionsConsistent(changed)).toBe(false);
    const aggregateOnly = structuredClone(packet);
    replaceAt(aggregateOnly, '/decision_model/stage_1/decision', 'APPROVE');
    for (const value of [null, 'REJECT', 'LEAVE_UNRESOLVED', 'UNKNOWN']) {
      replaceAt(aggregateOnly, `/required_human_decisions/${index}/decision`, value);
      expect(decisionsConsistent(aggregateOnly)).toBe(false);
    }
  });

  it('never promotes complete per-decision approval to aggregate approval', () => {
    const reviewOnly = structuredClone(packet);
    for (const [index, entry] of packet.required_human_decisions.entries()) {
      replaceAt(reviewOnly, `/required_human_decisions/${index}/decision`, 'APPROVE');
      replaceAt(reviewOnly, `${entry.policy_ref}/human_decision`, 'APPROVE');
      if (entry.detail_ref) replaceAt(reviewOnly, `${entry.detail_ref}/human_decision`, 'APPROVE');
    }
    for (const selection of packet.consistency_contract.specialized_choices) replaceAt(reviewOnly, selection.choice_path, selection.approve_choices[0]);
    expect(decisionsConsistent(reviewOnly)).toBe(true);
    expect(reviewOnly.decision_model.stage_1.decision).toBe('APPROVE');
    expect(reviewOnly.decision_model.stage_1.signature).toBe('drosado');
    expect(reviewOnly.schema_valid_subject_decision.human_resolution.evidence_object_type).toContain('/proposed_design/');
    expect(packet.authority_derivation_contract.predicate_contracts.stage_1_design_complete).toContain('Missing meaning, scope or decision blocks');
    for (const selection of packet.consistency_contract.specialized_choices) {
      const diverged = structuredClone(reviewOnly);
      replaceAt(diverged, selection.choice_path, null);
      expect(decisionsConsistent(diverged)).toBe(false);
    }
    const duplicate = structuredClone(reviewOnly);
    replaceAt(duplicate, '/required_human_decisions/1/id', packet.required_human_decisions[0].id);
    expect(decisionsConsistent(duplicate)).toBe(false);
  });

  it('provides explicit proposed Stage-1 policies without accepting them', () => {
    const semantics = packet.stage_1_semantic_designs;
    expect(semantics.status).toBe('PROPOSED_NOT_APPROVED');
    expect(Object.keys(semantics.claim_family.criteria)).toEqual(['universal', 'human', 'semantic', 'permission']);
    expect(semantics.claim_family.algorithm).toContain('exactly one criterion');
    expect(semantics.proof_available.acceptable_classes).toEqual(['SYNTHETIC_DOCUMENTARY_WITNESS', 'SYNTHETIC_FINITE_DERIVATION']);
    expect(semantics.proof_available.false_rule).toContain('NO_QUALIFYING_PROOF');
    expect(semantics.proof_supports_claim.existence_implies_support).toBe(false);
    expect(semantics.proof_supports_claim.evaluator_output_is_evidence).toBe(false);
    expect(semantics.proof_supports_claim.BLOCK_UNRESOLVED).toContain('blocks');
    expect(semantics.authority_present.qualifying_classes).toEqual(['FICTIONAL_DIRECT_GRANT', 'FICTIONAL_DELEGATION_CERTIFICATE']);
    expect(semantics.authority_valid.obligations).toHaveLength(4);
    expect(semantics.authority_valid.invariant).toBe('authority_valid = true -> authority_present = true');
    expect(semantics.duplicate_lineage.lexical_similarity_sufficient).toBe(false);
    expect(semantics.duplicate_lineage.repeated_ids_sufficient).toBe(false);
    expect(semantics.duplicate_lineage.incomplete).toContain('BLOCK_BEFORE_EVALUATION');
    expect(semantics.tool_permission.unknown).toContain('explicitly states UNDETERMINED');
    for (const subject of [packet.schema_valid_subject_decision, packet.contradiction_score_source_decision]) {
      expect(subject.proposed_design.version).toBe('proposed-v1');
      for (const key of subject.required_human_approvals) {
        expect(valueAt(subject, `/proposed_design/${key}`)).toBeTypeOf('string');
        expect(valueAt(subject, `/human_resolution/${key}`)).toContain('/proposed_design/');
      }
    }
    expect(packet.schema_valid_subject_decision.proposed_design.evidence_object_type).toContain('separately stored');
    expect(packet.schema_valid_subject_decision.proposed_design.validator_configuration_design).toContain('no coercion/defaults');
    const scoring = packet.contradiction_score_source_decision.proposed_design;
    expect(scoring.scoring_semantics_definition).toContain('Score is C/N');
    expect(scoring.scoring_semantics_definition).toContain('Zero means no pair contradicts');
    expect(scoring.scoring_semantics_definition).toContain('One means every pair contradicts');
    expect(scoring.scoring_instantiation_rules).toContain('N > 0');
    expect(scoring.relation_criteria.UNRESOLVED).toContain('blocks the entire score');
    expect(packet.stage_1_review_readiness.all_14_human_decisions_pending).toBe(false);
    expect(packet.stage_1_scope_design.approved_case_fixture_allowlist.case_ids).toHaveLength(32);
    expect(packet.stage_1_scope_design.membership_basis_reference.sha256).toBe('4A57C445E6F6F78147A1283F03BE248AF40BF31B3E89F64844C2A71B5904CAC7');
  });

  it('separates the independent reference from runtime payloads and implementation permission', () => {
    const derivation = packet.independent_expected_input_derivation;
    expect(derivation.name).toBe('INDEPENDENT_EXPECTED_INPUT_DERIVATION');
    expect(derivation.performed).toBe(false);
    expect(derivation.output).toContain('reference canonical representation != executable runtime payload');
    expect(derivation.not_permitted).toEqual(expect.arrayContaining([
      'Evaluator invocation', 'Executable runtime adaptive payload construction', 'Runtime emitter producing expected reference',
      'Using actual runtime output', 'Oracle/evaluator/feedback/performance-derived expected values', 'Holdout access'
    ]));
    expect(derivation.failure).toBe('STAGE_2_INCOMPLETE_NO_RUNTIME_PAYLOAD_CONSTRUCTION');
    const gate = packet.post_stage_2_implementation_gate;
    expect(gate.name).toBe('RETURN_FOR_NON_HOLDOUT_IMPLEMENTATION_AUTHORIZATION');
    expect(gate.status).toBe('NOT_REQUESTED_NOT_AUTHORIZED');
    expect(gate.stage_2_does_not_authorize).toHaveLength(9);
    expect(gate.current_payload_construction_state).toBe('BLOCKED_NO_SEPARATE_IMPLEMENTATION_AUTHORIZATION');
    expect(packet.adapter_decision.option_c_mandatory_requirements).toHaveLength(11);
    expect(packet.adapter_decision.unknown_or_malformed_input).toBe('TERMINATE_BEFORE_EVALUATOR_INVOCATION');
    expect(packet.adapter_decision.selected_adapter).toBe('C');
  });

  it('separates design approval from acceptance of instantiated source values', () => {
    const model = packet.decision_model;
    expect(model.current_stage).toBe('STAGE_1');
    expect(model.existing_approvals_reinterpreted).toBe(false);
    expect(model.stage_1).toMatchObject({
      name: 'HUMAN_SEMANTIC_SOURCE_DESIGN_DECISION', decision: 'APPROVE', signature: 'drosado', date: '09/11/2026 1235z',
      exact_source_artifacts_required_for_approval: false,
      approval_authorizes_only: 'NON_HOLDOUT_SYNTHETIC_SOURCE_INSTANTIATION_CONFORMING_TO_APPROVED_DESIGN',
      source_instantiation_authority_ref: '/authority_derivation_contract/rules/effective_stage_1_source_instantiation_authorized', adapter_selection_is_design_only: true
    });
    expect(model.stage_1.does_not_authorize).toEqual(expect.arrayContaining([
      'Candidate semantic value acceptance', 'Payload construction', 'Evaluator invocation',
      'Schema implementation', 'Adapter implementation', 'Runner implementation',
      'Full G3B revalidation', 'Comparative execution', 'Holdout access'
    ]));
    expect(model.stage_2).toMatchObject({
      name: 'HUMAN_SOURCE_INSTANTIATION_REVIEW', status: 'NOT_STARTED_AWAITING_SOURCE_INSTANTIATION',
      decision: null, signature: null, date: null,
      candidate_semantic_values_authority_ref: '/authority_derivation_contract/rules/effective_stage_2_candidate_semantic_values_resolved',
      payload_construction_authority_ref: '/post_stage_2_implementation_gate', source_changes_require_new_review: true
    });
    expect(model.stage_2.required_review_items).toEqual([
      'artifact_paths', 'artifact_hashes', 'exact_record_locators', 'case_id_fixture_id_bindings',
      'policy_version_hashes', 'independent_expected_values_and_digests', 'manifest_entries'
    ]);
    expect(Object.keys(model.stage_2.submission)).toEqual([...model.stage_2.required_review_items, 'stage_1_decision_reference']);
    expect(Object.values(model.stage_2.submission).every(value => value === null)).toBe(true);
    expect(model.stage_2.approval_effect).toContain('Only explicit Stage-2 approval');
    expect(packet.human_resolution_rules.source_policy_choices).toEqual(['APPROVE', 'REJECT', 'LEAVE_UNRESOLVED']);
    expect(packet.human_resolution_rules.approval_requirements.join(' ')).not.toMatch(/exact.*artifact|record locators/i);
    expect(packet.human_resolution_rules.stage_2_approval_requirements).toHaveLength(5);
    expect(packet.schema_valid_subject_decision.required_human_approvals).not.toContain('schema_hash');
    expect(packet.schema_valid_subject_decision.stage_2_required_evidence).toContain('schema_identity_hash');
    expect(packet.contradiction_score_source_decision.required_human_approvals).not.toContain('exact_source_artifact_hash_location');
    expect(packet.contradiction_score_source_decision.stage_2_required_evidence).toContain('exact_source_artifact_hash_location');
    expect(packet.source_manifest_proposal.stage_1_manifest_design_approval_requires_exact_entries).toBe(false);
    expect(packet.source_manifest_proposal.stage_2_manifest_entry_review_required).toBe(true);
  });

  it('records all fourteen explicit human Stage-1 decisions', () => {
    expect(packet.status).toBe('STAGE_1_APPROVED_FOR_NON_HOLDOUT_SOURCE_INSTANTIATION');
    expect(packet.policy_status).toBe('STAGE_1_DESIGN_APPROVED_SOURCE_VALUES_PENDING');
    expect(packet.decision).toBe('APPROVE');
    expect(packet.signature).toBe('drosado');
    expect(packet.date).toBe('09/11/2026 1235z');
    expect(packet.software_source_selection).toBe(false);
    expect(packet.required_human_decisions.map(entry => entry.id)).toEqual([
      'claim_family_source_policy', 'provenance_complete_policy', 'proof_available_policy',
      'proof_supports_claim_policy', 'schema_valid_subject_schema_validator', 'contradiction_score_source',
      'requested_tool_source', 'record_tool_source', 'authority_present_source', 'authority_valid_source',
      'duplicate_lineage_source', 'tool_permission_source', 'candidate_source_manifest_design', 'adapter_option'
    ]);
    packet.required_human_decisions.forEach((entry, index) => {
      expect(entry.decision).toBe('APPROVE');
      expect(entry.policy_ref).toBe(index < 12 ? `/source_policies/${index}` : index === 12 ? '/source_manifest_proposal' : '/adapter_decision');
      if ('detail_ref' in entry && entry.detail_ref) {
        const detail = packet[entry.detail_ref.slice(1) as keyof Packet];
        expect(detail).toMatchObject({ human_decision: 'APPROVE' });
      }
    });
  });

  it('covers exactly the twelve unresolved semantic fields without changing the approved contract', () => {
    const fields = packet.source_policies.map(policy => policy.field);
    expect(fields).toEqual(design.source_resolution.unresolved_fields);
    expect(fields).toEqual(packet.unresolved_evidence_requirements.fields);
    expect(new Set(fields).size).toBe(12);
    expect(packet.source_policies.filter(policy => policy.required_on === 'all')).toHaveLength(6);
    expect(packet.source_policies.filter(policy => policy.required_on === 'permission')).toHaveLength(6);
    expect(packet.unresolved_evidence_requirements).toMatchObject({
      all_source_artifacts_hashes_and_locations_pending: true, semantic_policy_approvals_pending: false,
      source_manifest_freeze_pending: true, adapter_approval_pending: false, ready_for_implementation: false
    });
  });

  it.each(packet.source_policies)('requires explicit evidence and binding for $field', policy => {
    expect(policy.human_decision).toBe('APPROVE');
    expect(policy.evidence_source_artifact).toBeNull();
    expect(policy.evidence_source_hash).toBeNull();
    expect(policy.source_location).toBeNull();
    expect(policy.semantic_definition.length).toBeGreaterThan(0);
    expect(policy.evidence_object.length).toBeGreaterThan(0);
    expect(policy.validation_rule.length).toBeGreaterThan(0);
    expect(policy.candidate_binding_requirement).toContain('case_id + fixture_id');
    expect(policy.fixture_binding_requirement).toContain('fixture');
    expect(policy.missing_evidence_behavior).toBe('BLOCK_BEFORE_EVALUATION');
    expect(policy.missing_evidence_means_false).toBe(false);
    const field = policy.field as keyof typeof design.proposed_schema.domains;
    expect(policy.allowed_value_domain).toEqual(design.proposed_schema.domains[field]);
    const domain = policy.allowed_value_domain;
    const booleanField = 'type' in domain && domain.type === 'boolean';
    expect(policy.value_can_be_false).toBe(booleanField);
    expect(policy.explicit_false_evidence.length).toBeGreaterThan(0);
    if (booleanField) expect(policy.explicit_false_evidence).not.toContain('NOT_IN_DOMAIN');
    else expect(policy.explicit_false_evidence).toContain('NOT_IN_DOMAIN');
  });

  it('requires human mapping approval and separates semantic completeness from integrity', () => {
    expect(packet.claim_family_source_decision).toMatchObject({
      choices: ['APPROVE_CANDIDATE_SPECIFIC_MAPPING_DESIGN', 'APPROVE_EXISTING_SOURCE_EQUIVALENCE_CRITERIA_DESIGN', 'LEAVE_UNRESOLVED'],
      required_mapping: 'case_id + fixture_id -> claim_family', logical_family_mapping_automatic: false,
      selected_choice: 'APPROVE_CANDIDATE_SPECIFIC_MAPPING_DESIGN', human_decision: 'APPROVE'
    });
    const policy = packet.semantic_completeness_policy;
    expect(policy.policy_identity).toBe('G3B_SEMANTIC_COMPLETENESS');
    expect(policy.policy_version).toBe('proposed-v1');
    expect(policy.policy_artifact_hash).toBeNull();
    expect(policy.human_decision).toBe('APPROVE');
    expect(policy.obligations.map(obligation => obligation.id)).toEqual([
      'CLAIM_ATTRIBUTION', 'EVIDENCE_ATTRIBUTION', 'CLAIM_EVIDENCE_LINKS', 'DERIVATION_LINEAGE', 'SCOPE_ACCOUNTING'
    ]);
    expect(policy.assessment_status_domain).toEqual(['SATISFIED', 'UNSATISFIED', 'UNKNOWN']);
    expect(policy.true_rule).toContain('Every obligation explicitly SATISFIED');
    expect(policy.false_rule).toContain('no UNKNOWN or missing');
    expect(policy.unknown_missing_rule).toBe('BLOCK_BEFORE_EVALUATION');
    expect(policy.unknown_takes_precedence_over_negative).toBe(true);
    expect(policy.transport_integrity_is_separate).toBe(true);
    expect(policy.does_not_require_proof_support_or_permission_grant).toBe(true);
  });

  it('distinguishes proof existence, explicit negative inventory and support assessments', () => {
    const availability = packet.source_policies.find(policy => policy.field === 'proof_available')!;
    const support = packet.source_policies.find(policy => policy.field === 'proof_supports_claim')!;
    expect(availability.evidence_object).toContain('NO_QUALIFYING_PROOF');
    expect(availability.validation_rule).toContain('missing proof object');
    expect(support.validation_rule).toContain('Existence of proof alone proves no support');
    expect(support.validation_rule).toContain('No evaluator-derived support');
    expect(packet.candidate_binding_rules.cross_field_invariants).toEqual([
      'proof_supports_claim = true -> proof_available = true',
      'authority_valid = true -> authority_present = true'
    ]);
  });

  it('rejects circular schema validation and leaves scoring semantics unresolved', () => {
    const subject = packet.schema_valid_subject_decision;
    expect(subject.rejected_subject).toBe('G3BAdaptiveEvaluatorInputV1');
    expect(subject.preferred_review_subject).toBe('SEPARATELY_IDENTIFIED_CANDIDATE_BOUND_EVIDENCE_OBJECT');
    expect(subject.selected_choice).toBe('APPROVE_SEPARATE_EVIDENCE_OBJECT_DETERMINISTIC_VALIDATION_DERIVATION_DESIGN');
    expect(subject.human_decision).toBe('APPROVE');
    expect(subject.hard_code_true).toBe(false);
    expect(Object.keys(subject.human_resolution)).toEqual(subject.required_human_approvals);
    expect(Object.values(subject.human_resolution).every(value => typeof value === 'string' && value.startsWith('/schema_valid_subject_decision/proposed_design/'))).toBe(true);
    expect(subject.proposed_pass_fail_interpretation).toEqual({
      completed_pass: 'true', completed_schema_fail: 'false', validator_error_or_incomplete_assessment: 'BLOCK_BEFORE_EVALUATION'
    });
    const score = packet.contradiction_score_source_decision;
    expect(Object.keys(score.human_resolution)).toEqual(score.required_human_approvals);
    expect(Object.values(score.human_resolution).every(value => typeof value === 'string' && value.startsWith('/contradiction_score_source_decision/proposed_design/'))).toBe(true);
    expect(score.human_decision).toBe('APPROVE');
    expect(score.historical_structural_fingerprint_input_automatically_reused).toBe(false);
    expect(score.no_legitimate_source).toBe('LEAVE_UNRESOLVED');
  });

  it('requires unique candidate and fixture binding plus independently frozen manifest digests', () => {
    expect(packet.global_source_rules.binding_key).toEqual(['case_id', 'fixture_id']);
    expect(packet.candidate_binding_rules.key).toEqual(['case_id', 'fixture_id']);
    expect(packet.candidate_binding_rules.permission_activation).toBe('claim_family = permission');
    expect(packet.candidate_binding_rules.other_permission_activators).toEqual([]);
    expect(packet.candidate_binding_rules.failed_binding).toBe('BLOCK_BEFORE_EVALUATION');
    const manifest = packet.source_manifest_proposal;
    expect(manifest.entry_binding_key).toEqual(['case_id', 'fixture_id']);
    expect(manifest.required_entry_fields).toEqual([
      'experiment_id', 'fixture_id', 'case_id', 'case_fingerprint', 'approved_semantic_source_version',
      'per_field_source_locations', 'source_artifact_hashes', 'expected_adaptive_candidate_payload_fingerprint',
      'contract_version', 'human_decision_commit', 'candidate_binding_evidence'
    ]);
    expect(manifest.contract_version).toBe(design.proposed_schema.contract_version);
    expect(manifest.manifest_artifact).toBeNull();
    expect(manifest.manifest_hash).toBeNull();
    expect(manifest.approved_semantic_source_version).toBe('G3B_SYNTHETIC_SOURCE_SEMANTICS@proposed-v1');
    expect(manifest.human_decision).toBe('APPROVE');
    expect(manifest.self_certifying_expected_digest_allowed).toBe(false);
    expect(manifest.manifest_created).toBe(false);
    expect(manifest.source_records_created).toBe(false);
    expect(manifest.human_decision_commit_semantics).toContain('cannot substitute for source approval');
  });

  it('records explicit adapter C design approval without changing baseline semantics', () => {
    expect(packet.recommended_adapter).toBe('C');
    expect(packet.selected_adapter).toBe('C');
    expect(packet.adapter_decision.options.map(option => option.id)).toEqual(['A', 'B', 'C']);
    expect(packet.adapter_decision.recommended_adapter).toBe('C');
    expect(packet.adapter_decision.selected_adapter).toBe('C');
    expect(packet.adapter_decision.human_decision).toBe('APPROVE');
    expect(packet.adapter_decision.implemented).toBe(false);
    expect(packet.adapter_decision.recommendation_reasons).toHaveLength(6);
    expect(packet.baseline_protection).toMatchObject({
      random_contract_changed: false, rule_based_contract_changed: false, runtime_semantics_changed: false,
      schema_changed: false, evaluator_changed: false, provenance_changed: false, stopping_changed: false,
      on_required_baseline_change: 'CROSS_ARM_IMPLEMENTATION_IMPACT'
    });
  });

  it.each(Object.entries({ ...design.source_basis, ...packet.source_basis }))('protects %s reference bytes without reading holdout', (_name, reference) => {
    expect(reference.path).not.toMatch(/holdout|partitions|\.\./i);
    expect(reference.path).toMatch(/^(experiments\/praetor_verify_001\/g3b\/|test\/)/);
    expect(createHash('sha256').update(readFileSync(new URL(reference.path, root))).digest('hex')).toBe(reference.sha256.toLowerCase());
  });

  it('keeps implementation and execution closed and requires future human gates', () => {
    expect(packet).toMatchObject({
      materiality: 'MATERIAL_NEW_SEMANTIC', full_non_holdout_revalidation_required: true,
      new_execution_reauthorization_required: true, full_g3b_revalidation_started: false,
      holdout_access_status: 'NOT_ACCESSED', holdout_evaluated: false, execution_performed: false,
      comparative_observations: 0, adaptive_schema_implemented: false, adaptive_candidate_payloads_created: false,
      adaptive_end_to_end_runner_implemented: false, effective_execution_authorized_for_new_basis: false,
      stop_condition: 'RETURN_FOR_STAGE_2_SOURCE_INSTANTIATION_REVIEW'
    });
    expect(packet.human_resolution_rules.no_inferred_approvals).toBe(true);
    expect(packet.human_resolution_rules.leave_unresolved).toBe('BLOCK_BEFORE_EVALUATION');
    expect(packet.global_source_rules).toMatchObject({
      missing_evidence_behavior: 'BLOCK_BEFORE_EVALUATION', missing_evidence_means_false: false,
      no_normalization: true, no_fallback: true, no_runtime_repair: true, historical_contracts_unchanged: true
    });
  });
});