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
    ],
    "columns": {
      "action_id": "text",
      "function": "text",
      "action_name": "text",
      "trigger_rule": "text",
      "scope_eligibility": "text",
      "accountable_owner_role": "text",
      "estimated_cost_usd": "number",
      "time_to_impact_days": "number",
      "implementation_effort": "text",
      "financial_effect_formula": "text",
      "expected_benefit_usd_m": "number",
      "risk_reduction_points": "number",
      "dependencies": "text",
      "exclusions": "text",
      "active_flag": "number"
    }
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
    ],
    "columns": {
      "recommendation_id": "text",
      "action_id": "text",
      "as_of_date": "date",
      "scope_id": "text",
      "trigger_evidence": "text",
      "supporting_diagnostic": "text",
      "supporting_prediction": "text",
      "gross_financial_benefit_usd": "number",
      "implementation_cost_usd": "number",
      "net_financial_benefit_usd": "number",
      "cash_benefit_usd": "number",
      "risk_reduction_points": "number",
      "workforce_effect_fte": "number",
      "confidence_score": "number",
      "priority_score": "number",
      "accountable_owner_role": "text",
      "time_to_impact_days": "number",
      "rationale": "text",
      "model_or_rule_id": "text"
    }
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
    ],
    "columns": {
      "constraint_id": "text",
      "scenario_id": "text",
      "constraint_name": "text",
      "operator": "text",
      "constraint_value": "number",
      "unit": "text",
      "mandatory_flag": "number"
    }
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
    ],
    "columns": {
      "account_id": "text",
      "account_code": "text",
      "account_name": "text",
      "account_category": "text",
      "financial_statement": "text",
      "normal_balance": "text",
      "materiality_group": "text",
      "active_flag": "number"
    }
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
    ],
    "columns": {
      "cost_center_id": "text",
      "org_unit_id": "text",
      "cost_center_name": "text",
      "owner_role_id": "text",
      "active_flag": "number",
      "cost_center_type": "text"
    }
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
    ],
    "columns": {
      "customer_id": "text",
      "customer_name": "text",
      "region": "text",
      "segment": "text",
      "industry": "text",
      "credit_rating": "text",
      "payment_terms_days": "number",
      "strategic_flag": "number",
      "relationship_owner_role_id": "text",
      "active_from": "date",
      "active_flag": "number",
      "south_concentration_flag": "number"
    }
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
    ],
    "columns": {
      "date_id": "number",
      "date": "date",
      "day_name": "text",
      "week_of_year": "number",
      "month_num": "number",
      "month_name": "text",
      "month_id": "number",
      "quarter": "text",
      "financial_year": "number",
      "working_day": "number",
      "holiday_flag": "number",
      "season": "text",
      "peak_period_flag": "number",
      "actual_forecast_flag": "text",
      "as_of_date": "date",
      "business_days_in_month": "number"
    }
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
    ],
    "columns": {
      "employee_id": "text",
      "employee_alias": "text",
      "org_unit_id": "text",
      "role": "text",
      "job_level": "text",
      "manager_id": "text",
      "hire_date": "date",
      "exit_date": "date",
      "employment_status": "text",
      "critical_role_flag": "number",
      "base_salary": "number",
      "currency": "text",
      "protected_attributes_excluded_flag": "number"
    }
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
    ],
    "columns": {
      "org_unit_id": "text",
      "parent_org_id": "text",
      "entity_id": "text",
      "entity": "text",
      "region": "text",
      "business_unit": "text",
      "department": "text",
      "location": "text",
      "currency": "text",
      "active_from": "date",
      "active_to": "text",
      "accountable_role_id": "text",
      "story_scope_flag": "number"
    }
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
    ],
    "columns": {
      "offering_id": "text",
      "offering_name": "text",
      "business_unit": "text",
      "offering_type": "text",
      "margin_class": "text",
      "list_price": "number",
      "direct_cost_ratio": "number",
      "strategic_priority": "text",
      "active_flag": "number"
    }
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
    ],
    "columns": {
      "control_id": "text",
      "risk_id": "text",
      "process": "text",
      "control_name": "text",
      "control_type": "text",
      "frequency": "text",
      "key_control_flag": "number",
      "control_owner_role_id": "text",
      "active_flag": "number",
      "risk_name": "text",
      "inherent_risk": "text",
      "risk_owner_role_id": "text"
    }
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
    ],
    "columns": {
      "vendor_id": "text",
      "vendor_name": "text",
      "region": "text",
      "category": "text",
      "criticality": "text",
      "approved_status": "text",
      "bank_account_token": "text",
      "risk_rating": "text",
      "active_flag": "number"
    }
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
    ],
    "columns": {
      "access_event_id": "text",
      "event_date": "date",
      "employee_id": "text",
      "org_unit_id": "text",
      "event_type": "text",
      "system_name": "text",
      "conflict_flag": "number",
      "privileged_flag": "number",
      "approval_status": "text",
      "days_open": "number",
      "story_scope_flag": "number"
    }
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
    ],
    "columns": {
      "ap_invoice_id": "text",
      "invoice_date": "date",
      "org_unit_id": "text",
      "vendor_id": "text",
      "invoice_amount": "number",
      "due_date": "date",
      "payment_date": "date",
      "payment_terms_days": "number",
      "invoice_status": "text",
      "duplicate_indicator": "number",
      "split_invoice_indicator": "number",
      "bank_change_proximity_flag": "number",
      "po_match_status": "text",
      "approver_role_id": "text"
    }
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
    ],
    "columns": {
      "ar_invoice_id": "text",
      "sales_id": "text",
      "invoice_date": "date",
      "org_unit_id": "text",
      "customer_id": "text",
      "invoice_amount": "number",
      "due_date": "date",
      "expected_payment_date": "date",
      "actual_payment_date": "text",
      "outstanding_amount": "number",
      "days_to_pay": "number",
      "days_past_due": "number",
      "dispute_flag": "number",
      "billing_error_flag": "number",
      "missing_approval_flag": "number",
      "collection_status": "text",
      "story_scope_flag": "number"
    }
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
    ],
    "columns": {
      "finding_id": "text",
      "org_unit_id": "text",
      "process": "text",
      "issue_date": "date",
      "severity": "text",
      "finding_title": "text",
      "monetary_exposure": "number",
      "issue_owner_role_id": "text",
      "target_date": "date",
      "status": "text",
      "repeat_finding_flag": "number",
      "story_scope_flag": "number"
    }
  },
  "fact-budget-forecast": {
    "table": "fact_budget_forecast",
    "rows": 64800,
    "defaultLimit": 100,
    "maxLimit": 1000,
    "orderBy": "month_id",
    "orderDir": "ASC",
    "dateColumn": "month_id",
    "dateKind": "month",
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
    ],
    "columns": {
      "month_id": "number",
      "org_unit_id": "text",
      "cost_center_id": "text",
      "account_id": "text",
      "account_category": "text",
      "version": "text",
      "budget_amount": "number",
      "forecast_amount": "number",
      "actual_amount": "number",
      "assumptions_id": "text",
      "owner_role_id": "text",
      "story_scope_flag": "number"
    }
  },
  "fact-cash-position": {
    "table": "fact_cash_position",
    "rows": 8768,
    "defaultLimit": 100,
    "maxLimit": 1000,
    "orderBy": "date_id",
    "orderDir": "ASC",
    "dateColumn": "date_id",
    "dateKind": "dateId",
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
    ],
    "columns": {
      "date_id": "number",
      "entity_id": "text",
      "currency": "text",
      "opening_balance": "number",
      "cash_inflow": "number",
      "cash_outflow": "number",
      "closing_balance": "number",
      "restricted_cash": "number",
      "story_scope_flag": "number"
    }
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
    ],
    "columns": {
      "opportunity_id": "text",
      "contract_id": "text",
      "created_date": "date",
      "customer_id": "text",
      "offering_id": "text",
      "org_unit_id": "text",
      "owner_role_id": "text",
      "stage": "text",
      "probability": "number",
      "booking_value": "number",
      "expected_start_date": "date",
      "expected_end_date": "date",
      "renewal_date": "date",
      "sla_tier": "text",
      "won_lost_reason": "text",
      "contract_complexity": "text"
    }
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
    ],
    "columns": {
      "exception_id": "text",
      "control_id": "text",
      "transaction_ref": "text",
      "org_unit_id": "text",
      "exception_date": "date",
      "exception_type": "text",
      "severity": "text",
      "monetary_exposure": "number",
      "repeat_flag": "number",
      "owner_role_id": "text",
      "status": "text",
      "root_cause": "text",
      "story_scope_flag": "number"
    }
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
    ],
    "columns": {
      "test_id": "text",
      "control_id": "text",
      "org_unit_id": "text",
      "test_period": "text",
      "test_date": "date",
      "population_size": "number",
      "sample_size": "number",
      "result": "text",
      "exception_count": "number",
      "evidence_quality": "text",
      "tester_employee_id": "text",
      "story_scope_flag": "number"
    }
  },
  "fact-customer-monthly": {
    "table": "fact_customer_monthly",
    "rows": 43200,
    "defaultLimit": 100,
    "maxLimit": 1000,
    "orderBy": "customer_id",
    "orderDir": "ASC",
    "dateColumn": "month_id",
    "dateKind": "month",
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
    ],
    "columns": {
      "customer_id": "text",
      "month_id": "number",
      "revenue": "number",
      "gross_margin": "number",
      "order_count": "number",
      "average_discount_pct": "number",
      "service_cases": "number",
      "disputes": "number",
      "sla_breaches": "number",
      "credit_notes": "number",
      "dso_days": "number",
      "outstanding_balance": "number",
      "invoice_count": "number",
      "segment": "text",
      "region": "text",
      "credit_rating": "text",
      "strategic_flag": "number",
      "gross_margin_pct": "number",
      "dispute_rate": "number",
      "service_health_score": "number",
      "relationship_engagement_score": "number",
      "renewal_within_180d_flag": "number"
    }
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
    ],
    "columns": {
      "case_id": "text",
      "opened_date": "date",
      "closed_date": "date",
      "org_unit_id": "text",
      "customer_id": "text",
      "case_type": "text",
      "severity": "text",
      "sla_breach_flag": "number",
      "dispute_flag": "number",
      "credit_note_amount": "number",
      "resolution_days": "number",
      "root_cause": "text",
      "story_scope_flag": "number"
    }
  },
  "fact-discount-approval": {
    "table": "fact_discount_approval",
    "rows": 20000,
    "defaultLimit": 100,
    "maxLimit": 1000,
    "orderBy": "approval_id",
    "orderDir": "ASC",
    "dateColumn": "date_id",
    "dateKind": "dateId",
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
    ],
    "columns": {
      "approval_id": "text",
      "sales_id": "text",
      "date_id": "number",
      "org_unit_id": "text",
      "customer_id": "text",
      "requested_discount_pct": "number",
      "policy_limit_pct": "number",
      "approval_status": "text",
      "override_flag": "number",
      "approver_role_id": "text",
      "override_reason": "text",
      "story_scope_flag": "number"
    }
  },
  "fact-employee-monthly": {
    "table": "fact_employee_monthly",
    "rows": 89600,
    "defaultLimit": 100,
    "maxLimit": 1000,
    "orderBy": "employee_id",
    "orderDir": "ASC",
    "dateColumn": "month_id",
    "dateKind": "month",
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
    ],
    "columns": {
      "employee_id": "text",
      "month_id": "number",
      "org_unit_id": "text",
      "role": "text",
      "manager_id": "text",
      "fte": "number",
      "base_pay_monthly": "number",
      "variable_pay_monthly": "number",
      "employment_status": "text",
      "tenure_years": "number",
      "performance_band": "text",
      "critical_role_flag": "number",
      "engagement_score": "number",
      "workload_index": "number",
      "story_scope_flag": "number"
    }
  },
  "fact-engagement-performance": {
    "table": "fact_engagement_performance",
    "rows": 12000,
    "defaultLimit": 100,
    "maxLimit": 1000,
    "orderBy": "survey_record_id",
    "orderDir": "ASC",
    "dateColumn": "quarter_id",
    "dateKind": "month",
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
    ],
    "columns": {
      "survey_record_id": "text",
      "employee_id": "text",
      "quarter_id": "number",
      "org_unit_id": "text",
      "engagement_score": "number",
      "manager_effectiveness_score": "number",
      "career_opportunity_score": "number",
      "workload_sustainability_score": "number",
      "performance_band": "text",
      "story_scope_flag": "number"
    }
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
    ],
    "columns": {
      "journal_id": "text",
      "line_id": "number",
      "posting_date": "date",
      "account_id": "text",
      "org_unit_id": "text",
      "cost_center_id": "text",
      "debit": "number",
      "credit": "number",
      "currency": "text",
      "source_system": "text",
      "manual_flag": "number",
      "preparer_employee_id": "text",
      "approver_employee_id": "text",
      "journal_type": "text",
      "description": "text",
      "story_scope_flag": "number"
    }
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
    ],
    "columns": {
      "event_id": "text",
      "employee_id": "text",
      "event_date": "date",
      "event_type": "text",
      "voluntary_flag": "number",
      "exit_reason": "text",
      "previous_org_unit_id": "text",
      "new_org_unit_id": "text",
      "role": "text",
      "replacement_required": "number",
      "regrettable_flag": "number"
    }
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
    ],
    "columns": {
      "remediation_id": "text",
      "finding_id": "text",
      "start_date": "date",
      "target_date": "date",
      "completion_date": "text",
      "status": "text",
      "owner_role_id": "text",
      "milestone_completion_pct": "number",
      "overdue_flag": "number",
      "validation_required_flag": "number",
      "residual_risk": "text"
    }
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
    ],
    "columns": {
      "learning_comp_id": "text",
      "employee_id": "text",
      "event_date": "date",
      "org_unit_id": "text",
      "event_type": "text",
      "learning_hours": "number",
      "compensation_change_pct": "number",
      "completion_status": "text",
      "critical_skill_flag": "number"
    }
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
    ],
    "columns": {
      "manual_journal_id": "text",
      "journal_id": "text",
      "posting_date": "date",
      "org_unit_id": "text",
      "amount": "number",
      "preparer_employee_id": "text",
      "approver_employee_id": "text",
      "late_posting_flag": "number",
      "weekend_posting_flag": "number",
      "round_amount_flag": "number",
      "same_preparer_approver_flag": "number",
      "risk_score": "number",
      "story_scope_flag": "number"
    }
  },
  "fact-reconciliation-close": {
    "table": "fact_reconciliation_close",
    "rows": 4320,
    "defaultLimit": 4320,
    "maxLimit": 4320,
    "orderBy": "due_date",
    "orderDir": "DESC",
    "dateColumn": "month_id",
    "dateKind": "month",
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
    ],
    "columns": {
      "close_task_id": "text",
      "month_id": "number",
      "entity_id": "text",
      "task_name": "text",
      "owner_role_id": "text",
      "due_date": "date",
      "completion_date": "date",
      "late_flag": "number",
      "adjustment_required_flag": "number",
      "reconciliation_exception_count": "number",
      "status": "text",
      "story_scope_flag": "number"
    }
  },
  "fact-sales-transaction": {
    "table": "fact_sales_transaction",
    "rows": 140000,
    "defaultLimit": 100,
    "maxLimit": 1000,
    "orderBy": "sales_id",
    "orderDir": "ASC",
    "dateColumn": "date_id",
    "dateKind": "dateId",
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
    ],
    "columns": {
      "sales_id": "text",
      "date_id": "number",
      "org_unit_id": "text",
      "customer_id": "text",
      "offering_id": "text",
      "contract_id": "text",
      "quantity": "number",
      "list_price": "number",
      "discount_pct": "number",
      "net_revenue": "number",
      "direct_cost": "number",
      "gross_margin": "number",
      "currency": "text",
      "channel": "text",
      "status": "text",
      "discount_override_indicator": "number",
      "story_scope_flag": "number"
    }
  },
  "fact-time-attendance": {
    "table": "fact_time_attendance",
    "rows": 89600,
    "defaultLimit": 100,
    "maxLimit": 1000,
    "orderBy": "employee_id",
    "orderDir": "ASC",
    "dateColumn": "month_id",
    "dateKind": "month",
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
    ],
    "columns": {
      "employee_id": "text",
      "month_id": "number",
      "org_unit_id": "text",
      "story_scope_flag": "number",
      "scheduled_hours": "number",
      "worked_hours": "number",
      "overtime_hours": "number",
      "absence_hours": "number",
      "absence_type": "text",
      "utilisation_pct": "number",
      "timesheet_late_flag": "number"
    }
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
    ],
    "columns": {
      "vacancy_id": "text",
      "org_unit_id": "text",
      "role": "text",
      "open_date": "date",
      "target_fill_date": "date",
      "actual_fill_date": "text",
      "status": "text",
      "critical_role_flag": "number",
      "time_to_fill_days": "number",
      "candidate_pipeline_count": "number",
      "hiring_manager_role_id": "text",
      "recruitment_cost": "number",
      "story_scope_flag": "number"
    }
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
    ],
    "columns": {
      "vendor_change_id": "text",
      "change_date": "date",
      "vendor_id": "text",
      "change_type": "text",
      "old_value_token": "text",
      "new_value_token": "text",
      "requestor_employee_id": "text",
      "approver_employee_id": "text",
      "emergency_change_flag": "number",
      "payment_within_7d_flag": "number",
      "risk_indicator_flag": "number"
    }
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
    ],
    "columns": {
      "endpoint": "text",
      "purpose": "text",
      "source_tables": "text"
    }
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
    ],
    "columns": {
      "kpi_name": "text",
      "definition": "text",
      "unit": "text",
      "authoritative_source": "text"
    }
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
    ],
    "columns": {
      "org_unit_id": "text",
      "month_id": "number",
      "month_start": "date",
      "demand_index": "number",
      "pricing_pressure_index": "number",
      "capacity_index": "number",
      "engagement_index": "number",
      "control_maturity_index": "number",
      "service_complexity_index": "number",
      "collection_effectiveness_index": "number",
      "story_scope_flag": "number"
    }
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
    ],
    "columns": {
      "model_id": "text",
      "model_name": "text",
      "model_version": "text",
      "method": "text",
      "as_of_date": "date",
      "training_start": "date",
      "training_end": "date",
      "approved_flag": "number",
      "owner": "text",
      "intended_use": "text"
    }
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
    ],
    "columns": {
      "prediction_id": "text",
      "entity_id": "text",
      "entity": "text",
      "region": "text",
      "process": "text",
      "as_of_date": "date",
      "forecast_quarter": "text",
      "material_exception_probability": "number",
      "expected_exception_count": "number",
      "expected_monetary_exposure": "number",
      "risk_band": "text",
      "driver_1": "text",
      "driver_2": "text",
      "driver_3": "text",
      "recommended_review_priority": "number",
      "confidence_score": "number",
      "model_id": "text",
      "model_version": "text",
      "run_id": "text"
    }
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
    ],
    "columns": {
      "prediction_id": "text",
      "customer_id": "text",
      "as_of_date": "date",
      "forecast_month": "date",
      "horizon_days": "number",
      "renewal_probability": "number",
      "churn_probability": "number",
      "late_payment_probability": "number",
      "revenue_at_risk": "number",
      "cash_at_risk": "number",
      "risk_band": "text",
      "driver_1": "text",
      "driver_2": "text",
      "driver_3": "text",
      "confidence_score": "number",
      "model_id": "text",
      "model_version": "text",
      "run_id": "text"
    }
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
    ],
    "columns": {
      "prediction_id": "text",
      "as_of_date": "date",
      "forecast_month": "date",
      "org_unit_id": "text",
      "region": "text",
      "business_unit": "text",
      "scenario_id": "text",
      "revenue_forecast": "number",
      "gross_margin_forecast": "number",
      "ebitda_forecast": "number",
      "ebitda_margin_pct": "number",
      "operating_cash_flow_forecast": "number",
      "dso_days": "number",
      "revenue_low": "number",
      "revenue_high": "number",
      "ebitda_margin_low": "number",
      "ebitda_margin_high": "number",
      "top_driver_1": "text",
      "top_driver_2": "text",
      "top_driver_3": "text",
      "model_id": "text",
      "model_version": "text",
      "run_id": "text",
      "confidence_score": "number"
    }
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
    ],
    "columns": {
      "prediction_id": "text",
      "org_unit_id": "text",
      "region": "text",
      "business_unit": "text",
      "role_cohort": "text",
      "as_of_date": "date",
      "horizon_days": "number",
      "headcount": "number",
      "attrition_probability": "number",
      "expected_exits": "number",
      "expected_capacity_gap_fte": "number",
      "revenue_or_service_impact_usd": "number",
      "risk_band": "text",
      "driver_1": "text",
      "driver_2": "text",
      "driver_3": "text",
      "confidence_score": "number",
      "model_id": "text",
      "model_version": "text",
      "run_id": "text"
    }
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
    ],
    "columns": {
      "scenario_result_id": "text",
      "scope_id": "text",
      "scenario_id": "text",
      "as_of_date": "date",
      "investment_usd_m": "number",
      "net_headcount_growth_pct": "number",
      "ebitda_margin_pct": "number",
      "dso_days": "number",
      "cohort_attrition_pct": "number",
      "control_risk_index": "number",
      "six_month_net_cash_benefit_usd_m": "number",
      "revenue_growth_pct": "number",
      "execution_risk": "text",
      "recommended_flag": "number",
      "rationale": "text",
      "calculation_run_id": "text"
    }
  },
  "serving-control-risk-scorecard-quarterly": {
    "table": "serving_control_risk_scorecard_quarterly",
    "rows": 288,
    "defaultLimit": 288,
    "maxLimit": 1000,
    "orderBy": "region",
    "orderDir": "ASC",
    "dateColumn": "quarter_id",
    "dateKind": "quarter",
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
    ],
    "columns": {
      "region": "text",
      "business_unit": "text",
      "quarter_id": "text",
      "exception_count": "number",
      "high_risk_count": "number",
      "repeat_count": "number",
      "monetary_exposure": "number",
      "control_risk_index": "number",
      "risk_band": "text"
    }
  },
  "serving-executive-scorecard-monthly": {
    "table": "serving_executive_scorecard_monthly",
    "rows": 864,
    "defaultLimit": 864,
    "maxLimit": 1000,
    "orderBy": "month_id",
    "orderDir": "DESC",
    "dateColumn": "month_id",
    "dateKind": "month",
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
    ],
    "columns": {
      "region": "text",
      "business_unit": "text",
      "month_id": "number",
      "revenue": "number",
      "gross_margin": "number",
      "average_discount_pct": "number",
      "transactions": "number",
      "headcount": "number",
      "workforce_cost": "number",
      "engagement_score": "number",
      "overtime_hours": "number",
      "absence_hours": "number",
      "utilisation_pct": "number",
      "exit_count": "number",
      "dso_days": "number",
      "outstanding_ar": "number",
      "disputed_ar": "number",
      "control_exceptions": "number",
      "high_risk_exceptions": "number",
      "control_exposure": "number",
      "vacancies_opened": "number",
      "critical_vacancies": "number",
      "gross_margin_pct": "number",
      "attrition_rate_pct": "number",
      "ebitda_margin_pct": "number",
      "ebitda": "number",
      "operating_cash_flow": "number",
      "control_risk_index": "number",
      "scope_id": "text",
      "scope_type": "text",
      "as_of_date": "date",
      "revenue_yoy_pct": "number"
    }
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
    ],
    "columns": {
      "bridge_id": "text",
      "scope_id": "text",
      "period_start": "date",
      "period_end": "date",
      "comparison_period": "text",
      "component": "text",
      "sequence": "number",
      "margin_before_pct": "number",
      "impact_percentage_points": "number",
      "margin_after_pct": "number",
      "estimated_ebitda_impact_usd": "number",
      "evidence_reference": "text"
    }
  }
};

module.exports = { TABLES };
