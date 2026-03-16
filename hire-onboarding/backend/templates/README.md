# Contract Templates

This directory should contain DOCX templates with `{{placeholder}}` syntax.

## Required Templates

1. `md_shareholder_contract.docx` - MD Shareholder Track contract
2. `md_non_shareholder_contract.docx` - MD Non-Shareholder Track contract
3. `crna_contract.docx` - CRNA contract

## Template Placeholders

The following placeholders are available for use in templates:

| Placeholder | Description |
|---|---|
| `{{fullLegalName}}` | Full legal name of the hire |
| `{{role}}` | Role / position title |
| `{{contractType}}` | Contract type (MD_SHAREHOLDER, etc.) |
| `{{startDate}}` | Employment start date |
| `{{salary}}` | Annual salary |
| `{{baseSalaryYear1}}` | Base salary for year 1 |
| `{{baseSalaryYear2}}` | Base salary for year 2 |
| `{{vacation}}` | Vacation terms |
| `{{shareholderStatus}}` | Shareholder/partner status |
| `{{compensationNotes}}` | Bonus terms, incentives |
| `{{roleSpecificTerms}}` | Any role-specific terms |
| `{{generationDate}}` | Date the contract was generated |

## How to Create Templates

1. Take your existing PDF contract templates
2. Open them in Word or Google Docs
3. Replace each variable section with the appropriate `{{placeholder}}`
4. Save as .docx format
5. Place in this directory

The system uses `docx-templates` library which supports:
- Simple text replacement: `{{fullLegalName}}`
- The delimiters are `{{` and `}}`
