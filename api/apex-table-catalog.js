/**
 * Apex table catalog. Built from the live apex_agent_demo schema.
 * Table and column names are a fixed whitelist. Query values are parameters.
 */

const TABLES = {
  "action-catalog": {
    "table": "action_catalog",
    "rows": 32,
    "defaultLimit": 32,
    "maxLimit": 1000,
    "orderBy": "action_id",
    "orderDir": "ASC",
    "dateColumn": null,
    "filters": [
      {
        "param": "action_id",
        "column": "action_id",
        "kind": "string"
      },
      {
        "param": "function",
        "column": "function",
        "kind": "string"
      },
      {
        "param": "action_name",
        "column": "action_name",
        "kind": "string"
      },
      {
        "param": "accountable_owner_role",
        "column": "accountable_owner_role",
        "kind": "string"
      },
      {
        "param": "implementation_effort",
        "column": "implementation_effort",
        "kind": "string"
      },
      {
        "param": "active_flag",
        "column": "active_flag",
        "kind": "flag"
      }
    ]
  },
  "action-recommendation": {
    "table": "action_recommendation",
    "rows": 1001,
    "defaultLimit": 1001,
    "maxLimit": 1001,
    "orderBy": "as_of_date",
    "orderDir": "DESC",
    "dateColumn": "as_of_date",
    "filters": [
      {
        "param": "recommendation_id",
        "column": "recommendation_id",
        "kind": "string"
      },
      {
        "param": "action_id",
        "column": "action_id",
        "kind": "string"
      },
      {
        "param": "scope_id",
        "column": "scope_id",
        "kind": "string"
      },
      {
        "param": "accountable_owner_role",
        "column": "accountable_owner_role",
        "kind": "string"
      },
      {
        "param": "model_or_rule_id",
        "column": "model_or_rule_id",
        "kind": "string"
      }
    ]
  },
  "decision-constraint": {
    "table": "decision_constraint",
    "rows": 24,
    "defaultLimit": 24,
    "maxLimit": 1000,
    "orderBy": "constraint_id",
    "orderDir": "ASC",
    "dateColumn": null,
    "filters": [
      {
        "param": "constraint_id",
        "column": "constraint_id",
        "kind": "string"
      },
      {
        "param": "scenario_id",
        "column": "scenario_id",
        "kind": "string"
      },
      {
        "param": "constraint_name",
        "column": "constraint_name",
        "kind": "string"
      },
      {
        "param": "operator",
        "column": "operator",
        "kind": "string"
      },
      {
        "param": "unit",
        "column": "unit",
        "kind": "string"
      },
      {
        "param": "mandatory_flag",
        "column": "mandatory_flag",
        "kind": "flag"
      }
    ]
  },
  "dim-account": {
    "table": "dim_account",
    "rows": 250,
    "defaultLimit": 250,
    "maxLimit": 1000,
    "orderBy": "account_id",
    "orderDir": "ASC",
    "dateColumn": null,
    "filters": [
      {
        "param": "account_id",
        "column": "account_id",
        "kind": "string"
      },
      {
        "param": "account_code",
        "column": "account_code",
        "kind": "string"
      },
      {
        "param": "account_name",
        "column": "account_name",
        "kind": "string"
      },
      {
        "param": "account_category",
        "column": "account_category",
        "kind": "string"
      },
      {
        "param": "financial_statement",
        "column": "financial_statement",
        "kind": "string"
      },
      {
        "param": "normal_balance",
        "column": "normal_balance",
        "kind": "string"
      },
      {
        "param": "materiality_group",
        "column": "materiality_group",
        "kind": "string"
      },
      {
        "param": "active_flag",
        "column": "active_flag",
        "kind": "flag"
      }
    ]
  },
  "dim-cost-center": {
    "table": "dim_cost_center",
    "rows": 120,
    "defaultLimit": 120,
    "maxLimit": 1000,
    "orderBy": "cost_center_id",
    "orderDir": "ASC",
    "dateColumn": null,
    "filters": [
      {
        "param": "cost_center_id",
        "column": "cost_center_id",
        "kind": "string"
      },
      {
        "param": "org_unit_id",
        "column": "org_unit_id",
        "kind": "string"
      },
      {
        "param": "cost_center_name",
        "column": "cost_center_name",
        "kind": "string"
      },
      {
        "param": "owner_role_id",
        "column": "owner_role_id",
        "kind": "string"
      },
      {
        "param": "active_flag",
        "column": "active_flag",
        "kind": "flag"
      },
      {
        "param": "cost_center_type",
        "column": "cost_center_type",
        "kind": "string"
      }
    ]
  },
  "dim-customer": {
    "table": "dim_customer",
    "rows": 1200,
    "defaultLimit": 1200,
    "maxLimit": 1200,
    "orderBy": "active_from",
    "orderDir": "DESC",
    "dateColumn": "active_from",
    "filters": [
      {
        "param": "customer_id",
        "column": "customer_id",
        "kind": "string"
      },
      {
        "param": "customer_name",
        "column": "customer_name",
        "kind": "string"
      },
      {
        "param": "region",
        "column": "region",
        "kind": "string"
      },
      {
        "param": "segment",
        "column": "segment",
        "kind": "string"
      },
      {
        "param": "industry",
        "column": "industry",
        "kind": "string"
      },
      {
        "param": "credit_rating",
        "column": "credit_rating",
        "kind": "string"
      },
      {
        "param": "strategic_flag",
        "column": "strategic_flag",
        "kind": "flag"
      },
      {
        "param": "relationship_owner_role_id",
        "column": "relationship_owner_role_id",
        "kind": "string"
      },
      {
        "param": "active_flag",
        "column": "active_flag",
        "kind": "flag"
      },
      {
        "param": "south_concentration_flag",
        "column": "south_concentration_flag",
        "kind": "flag"
      }
    ]
  },
  "dim-date": {
    "table": "dim_date",
    "rows": 1278,
    "defaultLimit": 1278,
    "maxLimit": 1278,
    "orderBy": "as_of_date",
    "orderDir": "DESC",
    "dateColumn": "as_of_date",
    "filters": [
      {
        "param": "date_from",
        "column": "date",
        "kind": "date-from"
      },
      {
        "param": "date_to",
        "column": "date",
        "kind": "date-to"
      },
      {
        "param": "date_id",
        "column": "date_id",
        "kind": "int"
      },
      {
        "param": "day_name",
        "column": "day_name",
        "kind": "string"
      },
      {
        "param": "month_name",
        "column": "month_name",
        "kind": "string"
      },
      {
        "param": "month_id",
        "column": "month_id",
        "kind": "int"
      },
      {
        "param": "quarter",
        "column": "quarter",
        "kind": "string"
      },
      {
        "param": "holiday_flag",
        "column": "holiday_flag",
        "kind": "flag"
      },
      {
        "param": "season",
        "column": "season",
        "kind": "string"
      },
      {
        "param": "peak_period_flag",
        "column": "peak_period_flag",
        "kind": "flag"
      },
      {
        "param": "actual_forecast_flag",
        "column": "actual_forecast_flag",
        "kind": "flag"
      }
    ]
  },
  "dim-employee": {
    "table": "dim_employee",
    "rows": 3200,
    "defaultLimit": 3200,
    "maxLimit": 3200,
    "orderBy": "hire_date",
    "orderDir": "DESC",
    "dateColumn": "hire_date",
    "filters": [
      {
        "param": "exit_date_from",
        "column": "exit_date",
        "kind": "date-from"
      },
      {
        "param": "exit_date_to",
        "column": "exit_date",
        "kind": "date-to"
      },
      {
        "param": "employee_id",
        "column": "employee_id",
        "kind": "string"
      },
      {
        "param": "employee_alias",
        "column": "employee_alias",
        "kind": "string"
      },
      {
        "param": "org_unit_id",
        "column": "org_unit_id",
        "kind": "string"
      },
      {
        "param": "role",
        "column": "role",
        "kind": "string"
      },
      {
        "param": "job_level",
        "column": "job_level",
        "kind": "string"
      },
      {
        "param": "manager_id",
        "column": "manager_id",
        "kind": "string"
      },
      {
        "param": "employment_status",
        "column": "employment_status",
        "kind": "string"
      },
      {
        "param": "critical_role_flag",
        "column": "critical_role_flag",
        "kind": "flag"
      },
      {
        "param": "currency",
        "column": "currency",
        "kind": "string"
      },
      {
        "param": "protected_attributes_excluded_flag",
        "column": "protected_attributes_excluded_flag",
        "kind": "flag"
      }
    ]
  },
  "dim-organisation": {
    "table": "dim_organisation",
    "rows": 96,
    "defaultLimit": 96,
    "maxLimit": 1000,
    "orderBy": "active_from",
    "orderDir": "DESC",
    "dateColumn": "active_from",
    "filters": [
      {
        "param": "org_unit_id",
        "column": "org_unit_id",
        "kind": "string"
      },
      {
        "param": "parent_org_id",
        "column": "parent_org_id",
        "kind": "string"
      },
      {
        "param": "entity_id",
        "column": "entity_id",
        "kind": "string"
      },
      {
        "param": "entity",
        "column": "entity",
        "kind": "string"
      },
      {
        "param": "region",
        "column": "region",
        "kind": "string"
      },
      {
        "param": "business_unit",
        "column": "business_unit",
        "kind": "string"
      },
      {
        "param": "department",
        "column": "department",
        "kind": "string"
      },
      {
        "param": "location",
        "column": "location",
        "kind": "string"
      },
      {
        "param": "currency",
        "column": "currency",
        "kind": "string"
      },
      {
        "param": "accountable_role_id",
        "column": "accountable_role_id",
        "kind": "string"
      },
      {
        "param": "story_scope_flag",
        "column": "story_scope_flag",
        "kind": "flag"
      }
    ]
  },
  "dim-product-service": {
    "table": "dim_product_service",
    "rows": 60,
    "defaultLimit": 60,
    "maxLimit": 1000,
    "orderBy": "offering_id",
    "orderDir": "ASC",
    "dateColumn": null,
    "filters": [
      {
        "param": "offering_id",
        "column": "offering_id",
        "kind": "string"
      },
      {
        "param": "offering_name",
        "column": "offering_name",
        "kind": "string"
      },
      {
        "param": "business_unit",
        "column": "business_unit",
        "kind": "string"
      },
      {
        "param": "offering_type",
        "column": "offering_type",
        "kind": "string"
      },
      {
        "param": "margin_class",
        "column": "margin_class",
        "kind": "string"
      },
      {
        "param": "strategic_priority",
        "column": "strategic_priority",
        "kind": "string"
      },
      {
        "param": "active_flag",
        "column": "active_flag",
        "kind": "flag"
      }
    ]
  },
  "dim-risk-control": {
    "table": "dim_risk_control",
    "rows": 60,
    "defaultLimit": 60,
    "maxLimit": 1000,
    "orderBy": "control_id",
    "orderDir": "ASC",
    "dateColumn": null,
    "filters": [
      {
        "param": "control_id",
        "column": "control_id",
        "kind": "string"
      },
      {
        "param": "risk_id",
        "column": "risk_id",
        "kind": "string"
      },
      {
        "param": "process",
        "column": "process",
        "kind": "string"
      },
      {
        "param": "control_name",
        "column": "control_name",
        "kind": "string"
      },
      {
        "param": "control_type",
        "column": "control_type",
        "kind": "string"
      },
      {
        "param": "frequency",
        "column": "frequency",
        "kind": "string"
      },
      {
        "param": "key_control_flag",
        "column": "key_control_flag",
        "kind": "flag"
      },
      {
        "param": "control_owner_role_id",
        "column": "control_owner_role_id",
        "kind": "string"
      },
      {
        "param": "active_flag",
        "column": "active_flag",
        "kind": "flag"
      },
      {
        "param": "risk_name",
        "column": "risk_name",
        "kind": "string"
      },
      {
        "param": "inherent_risk",
        "column": "inherent_risk",
        "kind": "string"
      },
      {
        "param": "risk_owner_role_id",
        "column": "risk_owner_role_id",
        "kind": "string"
      }
    ]
  },
  "dim-vendor": {
    "table": "dim_vendor",
    "rows": 350,
    "defaultLimit": 350,
    "maxLimit": 1000,
    "orderBy": "vendor_id",
    "orderDir": "ASC",
    "dateColumn": null,
    "filters": [
      {
        "param": "vendor_id",
        "column": "vendor_id",
        "kind": "string"
      },
      {
        "param": "vendor_name",
        "column": "vendor_name",
        "kind": "string"
      },
      {
        "param": "region",
        "column": "region",
        "kind": "string"
      },
      {
        "param": "category",
        "column": "category",
        "kind": "string"
      },
      {
        "param": "criticality",
        "column": "criticality",
        "kind": "string"
      },
      {
        "param": "approved_status",
        "column": "approved_status",
        "kind": "string"
      },
      {
        "param": "bank_account_token",
        "column": "bank_account_token",
        "kind": "string"
      },
      {
        "param": "risk_rating",
        "column": "risk_rating",
        "kind": "string"
      },
      {
        "param": "active_flag",
        "column": "active_flag",
        "kind": "flag"
      }
    ]
  },
  "fact-access-sod-event": {
    "table": "fact_access_sod_event",
    "rows": 14000,
    "defaultLimit": 100,
    "maxLimit": 1000,
    "orderBy": "event_date",
    "orderDir": "DESC",
    "dateColumn": "event_date",
    "filters": [
      {
        "param": "access_event_id",
        "column": "access_event_id",
        "kind": "string"
      },
      {
        "param": "employee_id",
        "column": "employee_id",
        "kind": "string"
      },
      {
        "param": "org_unit_id",
        "column": "org_unit_id",
        "kind": "string"
      },
      {
        "param": "event_type",
        "column": "event_type",
        "kind": "string"
      },
      {
        "param": "system_name",
        "column": "system_name",
        "kind": "string"
      },
      {
        "param": "conflict_flag",
        "column": "conflict_flag",
        "kind": "flag"
      },
      {
        "param": "privileged_flag",
        "column": "privileged_flag",
        "kind": "flag"
      },
      {
        "param": "approval_status",
        "column": "approval_status",
        "kind": "string"
      },
      {
        "param": "story_scope_flag",
        "column": "story_scope_flag",
        "kind": "flag"
      }
    ]
  },
  "fact-ap-invoice-payment": {
    "table": "fact_ap_invoice_payment",
    "rows": 50000,
    "defaultLimit": 100,
    "maxLimit": 1000,
    "orderBy": "invoice_date",
    "orderDir": "DESC",
    "dateColumn": "invoice_date",
    "filters": [
      {
        "param": "due_date_from",
        "column": "due_date",
        "kind": "date-from"
      },
      {
        "param": "due_date_to",
        "column": "due_date",
        "kind": "date-to"
      },
      {
        "param": "payment_date_from",
        "column": "payment_date",
        "kind": "date-from"
      },
      {
        "param": "payment_date_to",
        "column": "payment_date",
        "kind": "date-to"
      },
      {
        "param": "ap_invoice_id",
        "column": "ap_invoice_id",
        "kind": "string"
      },
      {
        "param": "org_unit_id",
        "column": "org_unit_id",
        "kind": "string"
      },
      {
        "param": "vendor_id",
        "column": "vendor_id",
        "kind": "string"
      },
      {
        "param": "invoice_status",
        "column": "invoice_status",
        "kind": "string"
      },
      {
        "param": "bank_change_proximity_flag",
        "column": "bank_change_proximity_flag",
        "kind": "flag"
      },
      {
        "param": "po_match_status",
        "column": "po_match_status",
        "kind": "string"
      },
      {
        "param": "approver_role_id",
        "column": "approver_role_id",
        "kind": "string"
      }
    ]
  },
  "fact-ar-invoice-payment": {
    "table": "fact_ar_invoice_payment",
    "rows": 50000,
    "defaultLimit": 100,
    "maxLimit": 1000,
    "orderBy": "invoice_date",
    "orderDir": "DESC",
    "dateColumn": "invoice_date",
    "filters": [
      {
        "param": "due_date_from",
        "column": "due_date",
        "kind": "date-from"
      },
      {
        "param": "due_date_to",
        "column": "due_date",
        "kind": "date-to"
      },
      {
        "param": "expected_payment_date_from",
        "column": "expected_payment_date",
        "kind": "date-from"
      },
      {
        "param": "expected_payment_date_to",
        "column": "expected_payment_date",
        "kind": "date-to"
      },
      {
        "param": "ar_invoice_id",
        "column": "ar_invoice_id",
        "kind": "string"
      },
      {
        "param": "sales_id",
        "column": "sales_id",
        "kind": "string"
      },
      {
        "param": "org_unit_id",
        "column": "org_unit_id",
        "kind": "string"
      },
      {
        "param": "customer_id",
        "column": "customer_id",
        "kind": "string"
      },
      {
        "param": "actual_payment_date",
        "column": "actual_payment_date",
        "kind": "string"
      },
      {
        "param": "dispute_flag",
        "column": "dispute_flag",
        "kind": "flag"
      },
      {
        "param": "billing_error_flag",
        "column": "billing_error_flag",
        "kind": "flag"
      },
      {
        "param": "missing_approval_flag",
        "column": "missing_approval_flag",
        "kind": "flag"
      },
      {
        "param": "collection_status",
        "column": "collection_status",
        "kind": "string"
      },
      {
        "param": "story_scope_flag",
        "column": "story_scope_flag",
        "kind": "flag"
      }
    ]
  },
  "fact-audit-finding": {
    "table": "fact_audit_finding",
    "rows": 1200,
    "defaultLimit": 1200,
    "maxLimit": 1200,
    "orderBy": "issue_date",
    "orderDir": "DESC",
    "dateColumn": "issue_date",
    "filters": [
      {
        "param": "target_date_from",
        "column": "target_date",
        "kind": "date-from"
      },
      {
        "param": "target_date_to",
        "column": "target_date",
        "kind": "date-to"
      },
      {
        "param": "finding_id",
        "column": "finding_id",
        "kind": "string"
      },
      {
        "param": "org_unit_id",
        "column": "org_unit_id",
        "kind": "string"
      },
      {
        "param": "process",
        "column": "process",
        "kind": "string"
      },
      {
        "param": "severity",
        "column": "severity",
        "kind": "string"
      },
      {
        "param": "issue_owner_role_id",
        "column": "issue_owner_role_id",
        "kind": "string"
      },
      {
        "param": "status",
        "column": "status",
        "kind": "string"
      },
      {
        "param": "repeat_finding_flag",
        "column": "repeat_finding_flag",
        "kind": "flag"
      },
      {
        "param": "story_scope_flag",
        "column": "story_scope_flag",
        "kind": "flag"
      }
    ]
  },
  "fact-budget-forecast": {
    "table": "fact_budget_forecast",
    "rows": 64800,
    "defaultLimit": 100,
    "maxLimit": 1000,
    "orderBy": "month_id",
    "orderDir": "ASC",
    "dateColumn": null,
    "filters": [
      {
        "param": "month_id",
        "column": "month_id",
        "kind": "int"
      },
      {
        "param": "org_unit_id",
        "column": "org_unit_id",
        "kind": "string"
      },
      {
        "param": "cost_center_id",
        "column": "cost_center_id",
        "kind": "string"
      },
      {
        "param": "account_id",
        "column": "account_id",
        "kind": "string"
      },
      {
        "param": "account_category",
        "column": "account_category",
        "kind": "string"
      },
      {
        "param": "version",
        "column": "version",
        "kind": "string"
      },
      {
        "param": "assumptions_id",
        "column": "assumptions_id",
        "kind": "string"
      },
      {
        "param": "owner_role_id",
        "column": "owner_role_id",
        "kind": "string"
      },
      {
        "param": "story_scope_flag",
        "column": "story_scope_flag",
        "kind": "flag"
      }
    ]
  },
  "fact-cash-position": {
    "table": "fact_cash_position",
    "rows": 8768,
    "defaultLimit": 100,
    "maxLimit": 1000,
    "orderBy": "date_id",
    "orderDir": "ASC",
    "dateColumn": null,
    "filters": [
      {
        "param": "date_id",
        "column": "date_id",
        "kind": "int"
      },
      {
        "param": "entity_id",
        "column": "entity_id",
        "kind": "string"
      },
      {
        "param": "currency",
        "column": "currency",
        "kind": "string"
      },
      {
        "param": "story_scope_flag",
        "column": "story_scope_flag",
        "kind": "flag"
      }
    ]
  },
  "fact-contract-pipeline": {
    "table": "fact_contract_pipeline",
    "rows": 14000,
    "defaultLimit": 100,
    "maxLimit": 1000,
    "orderBy": "created_date",
    "orderDir": "DESC",
    "dateColumn": "created_date",
    "filters": [
      {
        "param": "expected_start_date_from",
        "column": "expected_start_date",
        "kind": "date-from"
      },
      {
        "param": "expected_start_date_to",
        "column": "expected_start_date",
        "kind": "date-to"
      },
      {
        "param": "expected_end_date_from",
        "column": "expected_end_date",
        "kind": "date-from"
      },
      {
        "param": "expected_end_date_to",
        "column": "expected_end_date",
        "kind": "date-to"
      },
      {
        "param": "renewal_date_from",
        "column": "renewal_date",
        "kind": "date-from"
      },
      {
        "param": "renewal_date_to",
        "column": "renewal_date",
        "kind": "date-to"
      },
      {
        "param": "opportunity_id",
        "column": "opportunity_id",
        "kind": "string"
      },
      {
        "param": "contract_id",
        "column": "contract_id",
        "kind": "string"
      },
      {
        "param": "customer_id",
        "column": "customer_id",
        "kind": "string"
      },
      {
        "param": "offering_id",
        "column": "offering_id",
        "kind": "string"
      },
      {
        "param": "org_unit_id",
        "column": "org_unit_id",
        "kind": "string"
      },
      {
        "param": "owner_role_id",
        "column": "owner_role_id",
        "kind": "string"
      },
      {
        "param": "stage",
        "column": "stage",
        "kind": "string"
      },
      {
        "param": "sla_tier",
        "column": "sla_tier",
        "kind": "string"
      },
      {
        "param": "won_lost_reason",
        "column": "won_lost_reason",
        "kind": "string"
      },
      {
        "param": "contract_complexity",
        "column": "contract_complexity",
        "kind": "string"
      }
    ]
  },
  "fact-control-exception": {
    "table": "fact_control_exception",
    "rows": 6000,
    "defaultLimit": 100,
    "maxLimit": 1000,
    "orderBy": "exception_date",
    "orderDir": "DESC",
    "dateColumn": "exception_date",
    "filters": [
      {
        "param": "exception_id",
        "column": "exception_id",
        "kind": "string"
      },
      {
        "param": "control_id",
        "column": "control_id",
        "kind": "string"
      },
      {
        "param": "transaction_ref",
        "column": "transaction_ref",
        "kind": "string"
      },
      {
        "param": "org_unit_id",
        "column": "org_unit_id",
        "kind": "string"
      },
      {
        "param": "exception_type",
        "column": "exception_type",
        "kind": "string"
      },
      {
        "param": "severity",
        "column": "severity",
        "kind": "string"
      },
      {
        "param": "repeat_flag",
        "column": "repeat_flag",
        "kind": "flag"
      },
      {
        "param": "owner_role_id",
        "column": "owner_role_id",
        "kind": "string"
      },
      {
        "param": "status",
        "column": "status",
        "kind": "string"
      },
      {
        "param": "story_scope_flag",
        "column": "story_scope_flag",
        "kind": "flag"
      }
    ]
  },
  "fact-control-test": {
    "table": "fact_control_test",
    "rows": 9000,
    "defaultLimit": 100,
    "maxLimit": 1000,
    "orderBy": "test_date",
    "orderDir": "DESC",
    "dateColumn": "test_date",
    "filters": [
      {
        "param": "test_id",
        "column": "test_id",
        "kind": "string"
      },
      {
        "param": "control_id",
        "column": "control_id",
        "kind": "string"
      },
      {
        "param": "org_unit_id",
        "column": "org_unit_id",
        "kind": "string"
      },
      {
        "param": "test_period",
        "column": "test_period",
        "kind": "string"
      },
      {
        "param": "result",
        "column": "result",
        "kind": "string"
      },
      {
        "param": "tester_employee_id",
        "column": "tester_employee_id",
        "kind": "string"
      },
      {
        "param": "story_scope_flag",
        "column": "story_scope_flag",
        "kind": "flag"
      }
    ]
  },
  "fact-customer-monthly": {
    "table": "fact_customer_monthly",
    "rows": 43200,
    "defaultLimit": 100,
    "maxLimit": 1000,
    "orderBy": "customer_id",
    "orderDir": "ASC",
    "dateColumn": null,
    "filters": [
      {
        "param": "customer_id",
        "column": "customer_id",
        "kind": "string"
      },
      {
        "param": "month_id",
        "column": "month_id",
        "kind": "int"
      },
      {
        "param": "segment",
        "column": "segment",
        "kind": "string"
      },
      {
        "param": "region",
        "column": "region",
        "kind": "string"
      },
      {
        "param": "credit_rating",
        "column": "credit_rating",
        "kind": "string"
      },
      {
        "param": "strategic_flag",
        "column": "strategic_flag",
        "kind": "flag"
      },
      {
        "param": "renewal_within_180d_flag",
        "column": "renewal_within_180d_flag",
        "kind": "flag"
      }
    ]
  },
  "fact-customer-service": {
    "table": "fact_customer_service",
    "rows": 35000,
    "defaultLimit": 100,
    "maxLimit": 1000,
    "orderBy": "opened_date",
    "orderDir": "DESC",
    "dateColumn": "opened_date",
    "filters": [
      {
        "param": "closed_date_from",
        "column": "closed_date",
        "kind": "date-from"
      },
      {
        "param": "closed_date_to",
        "column": "closed_date",
        "kind": "date-to"
      },
      {
        "param": "case_id",
        "column": "case_id",
        "kind": "string"
      },
      {
        "param": "org_unit_id",
        "column": "org_unit_id",
        "kind": "string"
      },
      {
        "param": "customer_id",
        "column": "customer_id",
        "kind": "string"
      },
      {
        "param": "case_type",
        "column": "case_type",
        "kind": "string"
      },
      {
        "param": "severity",
        "column": "severity",
        "kind": "string"
      },
      {
        "param": "sla_breach_flag",
        "column": "sla_breach_flag",
        "kind": "flag"
      },
      {
        "param": "dispute_flag",
        "column": "dispute_flag",
        "kind": "flag"
      },
      {
        "param": "story_scope_flag",
        "column": "story_scope_flag",
        "kind": "flag"
      }
    ]
  },
  "fact-discount-approval": {
    "table": "fact_discount_approval",
    "rows": 20000,
    "defaultLimit": 100,
    "maxLimit": 1000,
    "orderBy": "approval_id",
    "orderDir": "ASC",
    "dateColumn": null,
    "filters": [
      {
        "param": "approval_id",
        "column": "approval_id",
        "kind": "string"
      },
      {
        "param": "sales_id",
        "column": "sales_id",
        "kind": "string"
      },
      {
        "param": "date_id",
        "column": "date_id",
        "kind": "int"
      },
      {
        "param": "org_unit_id",
        "column": "org_unit_id",
        "kind": "string"
      },
      {
        "param": "customer_id",
        "column": "customer_id",
        "kind": "string"
      },
      {
        "param": "approval_status",
        "column": "approval_status",
        "kind": "string"
      },
      {
        "param": "override_flag",
        "column": "override_flag",
        "kind": "flag"
      },
      {
        "param": "approver_role_id",
        "column": "approver_role_id",
        "kind": "string"
      },
      {
        "param": "override_reason",
        "column": "override_reason",
        "kind": "string"
      },
      {
        "param": "story_scope_flag",
        "column": "story_scope_flag",
        "kind": "flag"
      }
    ]
  },
  "fact-employee-monthly": {
    "table": "fact_employee_monthly",
    "rows": 89600,
    "defaultLimit": 100,
    "maxLimit": 1000,
    "orderBy": "employee_id",
    "orderDir": "ASC",
    "dateColumn": null,
    "filters": [
      {
        "param": "employee_id",
        "column": "employee_id",
        "kind": "string"
      },
      {
        "param": "month_id",
        "column": "month_id",
        "kind": "int"
      },
      {
        "param": "org_unit_id",
        "column": "org_unit_id",
        "kind": "string"
      },
      {
        "param": "role",
        "column": "role",
        "kind": "string"
      },
      {
        "param": "manager_id",
        "column": "manager_id",
        "kind": "string"
      },
      {
        "param": "employment_status",
        "column": "employment_status",
        "kind": "string"
      },
      {
        "param": "performance_band",
        "column": "performance_band",
        "kind": "string"
      },
      {
        "param": "critical_role_flag",
        "column": "critical_role_flag",
        "kind": "flag"
      },
      {
        "param": "story_scope_flag",
        "column": "story_scope_flag",
        "kind": "flag"
      }
    ]
  },
  "fact-engagement-performance": {
    "table": "fact_engagement_performance",
    "rows": 12000,
    "defaultLimit": 100,
    "maxLimit": 1000,
    "orderBy": "survey_record_id",
    "orderDir": "ASC",
    "dateColumn": null,
    "filters": [
      {
        "param": "survey_record_id",
        "column": "survey_record_id",
        "kind": "string"
      },
      {
        "param": "employee_id",
        "column": "employee_id",
        "kind": "string"
      },
      {
        "param": "quarter_id",
        "column": "quarter_id",
        "kind": "int"
      },
      {
        "param": "org_unit_id",
        "column": "org_unit_id",
        "kind": "string"
      },
      {
        "param": "performance_band",
        "column": "performance_band",
        "kind": "string"
      },
      {
        "param": "story_scope_flag",
        "column": "story_scope_flag",
        "kind": "flag"
      }
    ]
  },
  "fact-gl-transaction": {
    "table": "fact_gl_transaction",
    "rows": 140000,
    "defaultLimit": 100,
    "maxLimit": 1000,
    "orderBy": "posting_date",
    "orderDir": "DESC",
    "dateColumn": "posting_date",
    "filters": [
      {
        "param": "journal_id",
        "column": "journal_id",
        "kind": "string"
      },
      {
        "param": "line_id",
        "column": "line_id",
        "kind": "int"
      },
      {
        "param": "account_id",
        "column": "account_id",
        "kind": "string"
      },
      {
        "param": "org_unit_id",
        "column": "org_unit_id",
        "kind": "string"
      },
      {
        "param": "cost_center_id",
        "column": "cost_center_id",
        "kind": "string"
      },
      {
        "param": "currency",
        "column": "currency",
        "kind": "string"
      },
      {
        "param": "source_system",
        "column": "source_system",
        "kind": "string"
      },
      {
        "param": "manual_flag",
        "column": "manual_flag",
        "kind": "flag"
      },
      {
        "param": "preparer_employee_id",
        "column": "preparer_employee_id",
        "kind": "string"
      },
      {
        "param": "approver_employee_id",
        "column": "approver_employee_id",
        "kind": "string"
      },
      {
        "param": "journal_type",
        "column": "journal_type",
        "kind": "string"
      },
      {
        "param": "story_scope_flag",
        "column": "story_scope_flag",
        "kind": "flag"
      }
    ]
  },
  "fact-hire-exit": {
    "table": "fact_hire_exit",
    "rows": 3288,
    "defaultLimit": 3288,
    "maxLimit": 3288,
    "orderBy": "event_date",
    "orderDir": "DESC",
    "dateColumn": "event_date",
    "filters": [
      {
        "param": "event_id",
        "column": "event_id",
        "kind": "string"
      },
      {
        "param": "employee_id",
        "column": "employee_id",
        "kind": "string"
      },
      {
        "param": "event_type",
        "column": "event_type",
        "kind": "string"
      },
      {
        "param": "voluntary_flag",
        "column": "voluntary_flag",
        "kind": "flag"
      },
      {
        "param": "previous_org_unit_id",
        "column": "previous_org_unit_id",
        "kind": "string"
      },
      {
        "param": "new_org_unit_id",
        "column": "new_org_unit_id",
        "kind": "string"
      },
      {
        "param": "role",
        "column": "role",
        "kind": "string"
      },
      {
        "param": "regrettable_flag",
        "column": "regrettable_flag",
        "kind": "flag"
      }
    ]
  },
  "fact-issue-remediation": {
    "table": "fact_issue_remediation",
    "rows": 3000,
    "defaultLimit": 3000,
    "maxLimit": 3000,
    "orderBy": "start_date",
    "orderDir": "DESC",
    "dateColumn": "start_date",
    "filters": [
      {
        "param": "target_date_from",
        "column": "target_date",
        "kind": "date-from"
      },
      {
        "param": "target_date_to",
        "column": "target_date",
        "kind": "date-to"
      },
      {
        "param": "remediation_id",
        "column": "remediation_id",
        "kind": "string"
      },
      {
        "param": "finding_id",
        "column": "finding_id",
        "kind": "string"
      },
      {
        "param": "completion_date",
        "column": "completion_date",
        "kind": "string"
      },
      {
        "param": "status",
        "column": "status",
        "kind": "string"
      },
      {
        "param": "owner_role_id",
        "column": "owner_role_id",
        "kind": "string"
      },
      {
        "param": "overdue_flag",
        "column": "overdue_flag",
        "kind": "flag"
      },
      {
        "param": "validation_required_flag",
        "column": "validation_required_flag",
        "kind": "flag"
      },
      {
        "param": "residual_risk",
        "column": "residual_risk",
        "kind": "string"
      }
    ]
  },
  "fact-learning-compensation": {
    "table": "fact_learning_compensation",
    "rows": 20000,
    "defaultLimit": 100,
    "maxLimit": 1000,
    "orderBy": "event_date",
    "orderDir": "DESC",
    "dateColumn": "event_date",
    "filters": [
      {
        "param": "learning_comp_id",
        "column": "learning_comp_id",
        "kind": "string"
      },
      {
        "param": "employee_id",
        "column": "employee_id",
        "kind": "string"
      },
      {
        "param": "org_unit_id",
        "column": "org_unit_id",
        "kind": "string"
      },
      {
        "param": "event_type",
        "column": "event_type",
        "kind": "string"
      },
      {
        "param": "completion_status",
        "column": "completion_status",
        "kind": "string"
      },
      {
        "param": "critical_skill_flag",
        "column": "critical_skill_flag",
        "kind": "flag"
      }
    ]
  },
  "fact-manual-journal": {
    "table": "fact_manual_journal",
    "rows": 5451,
    "defaultLimit": 100,
    "maxLimit": 1000,
    "orderBy": "posting_date",
    "orderDir": "DESC",
    "dateColumn": "posting_date",
    "filters": [
      {
        "param": "manual_journal_id",
        "column": "manual_journal_id",
        "kind": "string"
      },
      {
        "param": "journal_id",
        "column": "journal_id",
        "kind": "string"
      },
      {
        "param": "org_unit_id",
        "column": "org_unit_id",
        "kind": "string"
      },
      {
        "param": "preparer_employee_id",
        "column": "preparer_employee_id",
        "kind": "string"
      },
      {
        "param": "approver_employee_id",
        "column": "approver_employee_id",
        "kind": "string"
      },
      {
        "param": "late_posting_flag",
        "column": "late_posting_flag",
        "kind": "flag"
      },
      {
        "param": "weekend_posting_flag",
        "column": "weekend_posting_flag",
        "kind": "flag"
      },
      {
        "param": "round_amount_flag",
        "column": "round_amount_flag",
        "kind": "flag"
      },
      {
        "param": "same_preparer_approver_flag",
        "column": "same_preparer_approver_flag",
        "kind": "flag"
      },
      {
        "param": "story_scope_flag",
        "column": "story_scope_flag",
        "kind": "flag"
      }
    ]
  },
  "fact-reconciliation-close": {
    "table": "fact_reconciliation_close",
    "rows": 4320,
    "defaultLimit": 4320,
    "maxLimit": 4320,
    "orderBy": "due_date",
    "orderDir": "DESC",
    "dateColumn": "due_date",
    "filters": [
      {
        "param": "completion_date_from",
        "column": "completion_date",
        "kind": "date-from"
      },
      {
        "param": "completion_date_to",
        "column": "completion_date",
        "kind": "date-to"
      },
      {
        "param": "close_task_id",
        "column": "close_task_id",
        "kind": "string"
      },
      {
        "param": "month_id",
        "column": "month_id",
        "kind": "int"
      },
      {
        "param": "entity_id",
        "column": "entity_id",
        "kind": "string"
      },
      {
        "param": "task_name",
        "column": "task_name",
        "kind": "string"
      },
      {
        "param": "owner_role_id",
        "column": "owner_role_id",
        "kind": "string"
      },
      {
        "param": "late_flag",
        "column": "late_flag",
        "kind": "flag"
      },
      {
        "param": "adjustment_required_flag",
        "column": "adjustment_required_flag",
        "kind": "flag"
      },
      {
        "param": "status",
        "column": "status",
        "kind": "string"
      },
      {
        "param": "story_scope_flag",
        "column": "story_scope_flag",
        "kind": "flag"
      }
    ]
  },
  "fact-sales-transaction": {
    "table": "fact_sales_transaction",
    "rows": 140000,
    "defaultLimit": 100,
    "maxLimit": 1000,
    "orderBy": "sales_id",
    "orderDir": "ASC",
    "dateColumn": null,
    "filters": [
      {
        "param": "sales_id",
        "column": "sales_id",
        "kind": "string"
      },
      {
        "param": "date_id",
        "column": "date_id",
        "kind": "int"
      },
      {
        "param": "org_unit_id",
        "column": "org_unit_id",
        "kind": "string"
      },
      {
        "param": "customer_id",
        "column": "customer_id",
        "kind": "string"
      },
      {
        "param": "offering_id",
        "column": "offering_id",
        "kind": "string"
      },
      {
        "param": "contract_id",
        "column": "contract_id",
        "kind": "string"
      },
      {
        "param": "currency",
        "column": "currency",
        "kind": "string"
      },
      {
        "param": "channel",
        "column": "channel",
        "kind": "string"
      },
      {
        "param": "status",
        "column": "status",
        "kind": "string"
      },
      {
        "param": "story_scope_flag",
        "column": "story_scope_flag",
        "kind": "flag"
      }
    ]
  },
  "fact-time-attendance": {
    "table": "fact_time_attendance",
    "rows": 89600,
    "defaultLimit": 100,
    "maxLimit": 1000,
    "orderBy": "employee_id",
    "orderDir": "ASC",
    "dateColumn": null,
    "filters": [
      {
        "param": "employee_id",
        "column": "employee_id",
        "kind": "string"
      },
      {
        "param": "month_id",
        "column": "month_id",
        "kind": "int"
      },
      {
        "param": "org_unit_id",
        "column": "org_unit_id",
        "kind": "string"
      },
      {
        "param": "story_scope_flag",
        "column": "story_scope_flag",
        "kind": "flag"
      },
      {
        "param": "absence_type",
        "column": "absence_type",
        "kind": "string"
      },
      {
        "param": "timesheet_late_flag",
        "column": "timesheet_late_flag",
        "kind": "flag"
      }
    ]
  },
  "fact-vacancy-recruitment": {
    "table": "fact_vacancy_recruitment",
    "rows": 7000,
    "defaultLimit": 100,
    "maxLimit": 1000,
    "orderBy": "open_date",
    "orderDir": "DESC",
    "dateColumn": "open_date",
    "filters": [
      {
        "param": "target_fill_date_from",
        "column": "target_fill_date",
        "kind": "date-from"
      },
      {
        "param": "target_fill_date_to",
        "column": "target_fill_date",
        "kind": "date-to"
      },
      {
        "param": "vacancy_id",
        "column": "vacancy_id",
        "kind": "string"
      },
      {
        "param": "org_unit_id",
        "column": "org_unit_id",
        "kind": "string"
      },
      {
        "param": "role",
        "column": "role",
        "kind": "string"
      },
      {
        "param": "actual_fill_date",
        "column": "actual_fill_date",
        "kind": "string"
      },
      {
        "param": "status",
        "column": "status",
        "kind": "string"
      },
      {
        "param": "critical_role_flag",
        "column": "critical_role_flag",
        "kind": "flag"
      },
      {
        "param": "hiring_manager_role_id",
        "column": "hiring_manager_role_id",
        "kind": "string"
      },
      {
        "param": "story_scope_flag",
        "column": "story_scope_flag",
        "kind": "flag"
      }
    ]
  },
  "fact-vendor-master-change": {
    "table": "fact_vendor_master_change",
    "rows": 5000,
    "defaultLimit": 5000,
    "maxLimit": 5000,
    "orderBy": "change_date",
    "orderDir": "DESC",
    "dateColumn": "change_date",
    "filters": [
      {
        "param": "vendor_change_id",
        "column": "vendor_change_id",
        "kind": "string"
      },
      {
        "param": "vendor_id",
        "column": "vendor_id",
        "kind": "string"
      },
      {
        "param": "change_type",
        "column": "change_type",
        "kind": "string"
      },
      {
        "param": "old_value_token",
        "column": "old_value_token",
        "kind": "string"
      },
      {
        "param": "new_value_token",
        "column": "new_value_token",
        "kind": "string"
      },
      {
        "param": "requestor_employee_id",
        "column": "requestor_employee_id",
        "kind": "string"
      },
      {
        "param": "approver_employee_id",
        "column": "approver_employee_id",
        "kind": "string"
      },
      {
        "param": "emergency_change_flag",
        "column": "emergency_change_flag",
        "kind": "flag"
      },
      {
        "param": "payment_within_7d_flag",
        "column": "payment_within_7d_flag",
        "kind": "flag"
      },
      {
        "param": "risk_indicator_flag",
        "column": "risk_indicator_flag",
        "kind": "flag"
      }
    ]
  },
  "meta-endpoint-catalog": {
    "table": "meta_endpoint_catalog",
    "rows": 12,
    "defaultLimit": 12,
    "maxLimit": 1000,
    "orderBy": "endpoint",
    "orderDir": "ASC",
    "dateColumn": null,
    "filters": [
      {
        "param": "endpoint",
        "column": "endpoint",
        "kind": "string"
      },
      {
        "param": "purpose",
        "column": "purpose",
        "kind": "string"
      },
      {
        "param": "source_tables",
        "column": "source_tables",
        "kind": "string"
      }
    ]
  },
  "meta-kpi-definition": {
    "table": "meta_kpi_definition",
    "rows": 10,
    "defaultLimit": 10,
    "maxLimit": 1000,
    "orderBy": "kpi_name",
    "orderDir": "ASC",
    "dateColumn": null,
    "filters": [
      {
        "param": "kpi_name",
        "column": "kpi_name",
        "kind": "string"
      },
      {
        "param": "definition",
        "column": "definition",
        "kind": "string"
      },
      {
        "param": "unit",
        "column": "unit",
        "kind": "string"
      },
      {
        "param": "authoritative_source",
        "column": "authoritative_source",
        "kind": "string"
      }
    ]
  },
  "meta-latent-drivers-monthly": {
    "table": "meta_latent_drivers_monthly",
    "rows": 3456,
    "defaultLimit": 3456,
    "maxLimit": 3456,
    "orderBy": "month_start",
    "orderDir": "DESC",
    "dateColumn": "month_start",
    "filters": [
      {
        "param": "org_unit_id",
        "column": "org_unit_id",
        "kind": "string"
      },
      {
        "param": "month_id",
        "column": "month_id",
        "kind": "int"
      },
      {
        "param": "story_scope_flag",
        "column": "story_scope_flag",
        "kind": "flag"
      }
    ]
  },
  "meta-model-registry": {
    "table": "meta_model_registry",
    "rows": 4,
    "defaultLimit": 4,
    "maxLimit": 1000,
    "orderBy": "as_of_date",
    "orderDir": "DESC",
    "dateColumn": "as_of_date",
    "filters": [
      {
        "param": "training_start_from",
        "column": "training_start",
        "kind": "date-from"
      },
      {
        "param": "training_start_to",
        "column": "training_start",
        "kind": "date-to"
      },
      {
        "param": "training_end_from",
        "column": "training_end",
        "kind": "date-from"
      },
      {
        "param": "training_end_to",
        "column": "training_end",
        "kind": "date-to"
      },
      {
        "param": "model_id",
        "column": "model_id",
        "kind": "string"
      },
      {
        "param": "model_name",
        "column": "model_name",
        "kind": "string"
      },
      {
        "param": "model_version",
        "column": "model_version",
        "kind": "string"
      },
      {
        "param": "method",
        "column": "method",
        "kind": "string"
      },
      {
        "param": "approved_flag",
        "column": "approved_flag",
        "kind": "flag"
      },
      {
        "param": "owner",
        "column": "owner",
        "kind": "string"
      },
      {
        "param": "intended_use",
        "column": "intended_use",
        "kind": "string"
      }
    ]
  },
  "pred-control-risk": {
    "table": "pred_control_risk",
    "rows": 320,
    "defaultLimit": 320,
    "maxLimit": 1000,
    "orderBy": "as_of_date",
    "orderDir": "DESC",
    "dateColumn": "as_of_date",
    "filters": [
      {
        "param": "prediction_id",
        "column": "prediction_id",
        "kind": "string"
      },
      {
        "param": "entity_id",
        "column": "entity_id",
        "kind": "string"
      },
      {
        "param": "entity",
        "column": "entity",
        "kind": "string"
      },
      {
        "param": "region",
        "column": "region",
        "kind": "string"
      },
      {
        "param": "process",
        "column": "process",
        "kind": "string"
      },
      {
        "param": "forecast_quarter",
        "column": "forecast_quarter",
        "kind": "string"
      },
      {
        "param": "risk_band",
        "column": "risk_band",
        "kind": "string"
      },
      {
        "param": "model_id",
        "column": "model_id",
        "kind": "string"
      },
      {
        "param": "model_version",
        "column": "model_version",
        "kind": "string"
      },
      {
        "param": "run_id",
        "column": "run_id",
        "kind": "string"
      }
    ]
  },
  "pred-customer-risk": {
    "table": "pred_customer_risk",
    "rows": 7200,
    "defaultLimit": 100,
    "maxLimit": 1000,
    "orderBy": "as_of_date",
    "orderDir": "DESC",
    "dateColumn": "as_of_date",
    "filters": [
      {
        "param": "forecast_month_from",
        "column": "forecast_month",
        "kind": "date-from"
      },
      {
        "param": "forecast_month_to",
        "column": "forecast_month",
        "kind": "date-to"
      },
      {
        "param": "prediction_id",
        "column": "prediction_id",
        "kind": "string"
      },
      {
        "param": "customer_id",
        "column": "customer_id",
        "kind": "string"
      },
      {
        "param": "horizon_days",
        "column": "horizon_days",
        "kind": "int"
      },
      {
        "param": "risk_band",
        "column": "risk_band",
        "kind": "string"
      },
      {
        "param": "model_id",
        "column": "model_id",
        "kind": "string"
      },
      {
        "param": "model_version",
        "column": "model_version",
        "kind": "string"
      },
      {
        "param": "run_id",
        "column": "run_id",
        "kind": "string"
      }
    ]
  },
  "pred-financial-forecast": {
    "table": "pred_financial_forecast",
    "rows": 2304,
    "defaultLimit": 2304,
    "maxLimit": 2304,
    "orderBy": "as_of_date",
    "orderDir": "DESC",
    "dateColumn": "as_of_date",
    "filters": [
      {
        "param": "forecast_month_from",
        "column": "forecast_month",
        "kind": "date-from"
      },
      {
        "param": "forecast_month_to",
        "column": "forecast_month",
        "kind": "date-to"
      },
      {
        "param": "prediction_id",
        "column": "prediction_id",
        "kind": "string"
      },
      {
        "param": "org_unit_id",
        "column": "org_unit_id",
        "kind": "string"
      },
      {
        "param": "region",
        "column": "region",
        "kind": "string"
      },
      {
        "param": "business_unit",
        "column": "business_unit",
        "kind": "string"
      },
      {
        "param": "scenario_id",
        "column": "scenario_id",
        "kind": "string"
      },
      {
        "param": "model_id",
        "column": "model_id",
        "kind": "string"
      },
      {
        "param": "model_version",
        "column": "model_version",
        "kind": "string"
      },
      {
        "param": "run_id",
        "column": "run_id",
        "kind": "string"
      }
    ]
  },
  "pred-workforce-risk": {
    "table": "pred_workforce_risk",
    "rows": 1216,
    "defaultLimit": 1216,
    "maxLimit": 1216,
    "orderBy": "as_of_date",
    "orderDir": "DESC",
    "dateColumn": "as_of_date",
    "filters": [
      {
        "param": "prediction_id",
        "column": "prediction_id",
        "kind": "string"
      },
      {
        "param": "org_unit_id",
        "column": "org_unit_id",
        "kind": "string"
      },
      {
        "param": "region",
        "column": "region",
        "kind": "string"
      },
      {
        "param": "business_unit",
        "column": "business_unit",
        "kind": "string"
      },
      {
        "param": "role_cohort",
        "column": "role_cohort",
        "kind": "string"
      },
      {
        "param": "horizon_days",
        "column": "horizon_days",
        "kind": "int"
      },
      {
        "param": "risk_band",
        "column": "risk_band",
        "kind": "string"
      },
      {
        "param": "model_id",
        "column": "model_id",
        "kind": "string"
      },
      {
        "param": "model_version",
        "column": "model_version",
        "kind": "string"
      },
      {
        "param": "run_id",
        "column": "run_id",
        "kind": "string"
      }
    ]
  },
  "scenario-simulation": {
    "table": "scenario_simulation",
    "rows": 4,
    "defaultLimit": 4,
    "maxLimit": 1000,
    "orderBy": "as_of_date",
    "orderDir": "DESC",
    "dateColumn": "as_of_date",
    "filters": [
      {
        "param": "scenario_result_id",
        "column": "scenario_result_id",
        "kind": "string"
      },
      {
        "param": "scope_id",
        "column": "scope_id",
        "kind": "string"
      },
      {
        "param": "scenario_id",
        "column": "scenario_id",
        "kind": "string"
      },
      {
        "param": "execution_risk",
        "column": "execution_risk",
        "kind": "string"
      },
      {
        "param": "recommended_flag",
        "column": "recommended_flag",
        "kind": "flag"
      },
      {
        "param": "calculation_run_id",
        "column": "calculation_run_id",
        "kind": "string"
      }
    ]
  },
  "serving-control-risk-scorecard-quarterly": {
    "table": "serving_control_risk_scorecard_quarterly",
    "rows": 288,
    "defaultLimit": 288,
    "maxLimit": 1000,
    "orderBy": "region",
    "orderDir": "ASC",
    "dateColumn": null,
    "filters": [
      {
        "param": "region",
        "column": "region",
        "kind": "string"
      },
      {
        "param": "business_unit",
        "column": "business_unit",
        "kind": "string"
      },
      {
        "param": "quarter_id",
        "column": "quarter_id",
        "kind": "string"
      },
      {
        "param": "risk_band",
        "column": "risk_band",
        "kind": "string"
      }
    ]
  },
  "serving-executive-scorecard-monthly": {
    "table": "serving_executive_scorecard_monthly",
    "rows": 864,
    "defaultLimit": 864,
    "maxLimit": 1000,
    "orderBy": "as_of_date",
    "orderDir": "DESC",
    "dateColumn": "as_of_date",
    "filters": [
      {
        "param": "region",
        "column": "region",
        "kind": "string"
      },
      {
        "param": "business_unit",
        "column": "business_unit",
        "kind": "string"
      },
      {
        "param": "month_id",
        "column": "month_id",
        "kind": "int"
      },
      {
        "param": "scope_id",
        "column": "scope_id",
        "kind": "string"
      },
      {
        "param": "scope_type",
        "column": "scope_type",
        "kind": "string"
      }
    ]
  },
  "serving-margin-bridge": {
    "table": "serving_margin_bridge",
    "rows": 10,
    "defaultLimit": 10,
    "maxLimit": 1000,
    "orderBy": "period_start",
    "orderDir": "DESC",
    "dateColumn": "period_start",
    "filters": [
      {
        "param": "period_end_from",
        "column": "period_end",
        "kind": "date-from"
      },
      {
        "param": "period_end_to",
        "column": "period_end",
        "kind": "date-to"
      },
      {
        "param": "bridge_id",
        "column": "bridge_id",
        "kind": "string"
      },
      {
        "param": "scope_id",
        "column": "scope_id",
        "kind": "string"
      },
      {
        "param": "comparison_period",
        "column": "comparison_period",
        "kind": "string"
      },
      {
        "param": "component",
        "column": "component",
        "kind": "string"
      },
      {
        "param": "sequence",
        "column": "sequence",
        "kind": "int"
      }
    ]
  }
};

module.exports = { TABLES };
