/**
 * PII / PHI output redaction guardrail.
 *
 * Applied as a post-processing step to the final LLM response before it is
 * sent to the client. Acts as a reactive safety net — the preventive layer is
 * the system prompt instruction in the closer agent context.
 *
 * Patterns covered:
 *   - Email addresses
 *   - Phone numbers (US, Singapore, and general international)
 *   - US Social Security Numbers (SSN)
 *   - Credit / debit card numbers
 *   - Singapore NRIC / FIN numbers
 *   - Medical Record Numbers (MRN) when explicitly labelled
 *   - Dates of birth when explicitly labelled (DOB / date of birth / born on)
 */

interface RedactionRule {
  pattern: RegExp;
  replacement: string;
}

const RULES: RedactionRule[] = [
  // Email addresses
  {
    pattern: /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g,
    replacement: "[EMAIL REDACTED]",
  },

  // US phone numbers — (123) 456-7890 / 123-456-7890 / +1 123 456 7890
  {
    pattern: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/g,
    replacement: "[PHONE REDACTED]",
  },

  // Singapore phone numbers — +65 8xxx xxxx / 6xxx xxxx / 9xxx xxxx
  {
    pattern: /\b(?:\+65[-.\s]?)?[689]\d{3}[-.\s]?\d{4}\b/g,
    replacement: "[PHONE REDACTED]",
  },

  // General international numbers starting with + (7–15 digits)
  {
    pattern: /\+\d{1,3}[-.\s]?\d{3,5}[-.\s]?\d{4,10}\b/g,
    replacement: "[PHONE REDACTED]",
  },

  // US Social Security Numbers — 123-45-6789 / 123 45 6789
  {
    pattern: /\b\d{3}[-\s]\d{2}[-\s]\d{4}\b/g,
    replacement: "[SSN REDACTED]",
  },

  // Credit / debit card numbers — 16-digit groups
  {
    pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
    replacement: "[CARD REDACTED]",
  },

  // Singapore NRIC / FIN — S1234567A / T / F / G
  {
    pattern: /\b[STFG]\d{7}[A-Z]\b/g,
    replacement: "[NRIC REDACTED]",
  },

  // Medical Record Numbers — labelled MRN: 123456
  {
    pattern: /\bMRN[-:\s]+\d{4,12}\b/gi,
    replacement: "MRN: [MRN REDACTED]",
  },

  // Date of birth — labelled DOB / date of birth / born on
  {
    pattern: /\b(?:DOB|date of birth|born on)[-:\s]+\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/gi,
    replacement: "[DOB REDACTED]",
  },
];

/**
 * Redact PII/PHI from a text string.
 * Returns the redacted string; if no matches, returns the original unchanged.
 */
export function redactPII(text: string): string {
  let result = text;
  for (const { pattern, replacement } of RULES) {
    result = result.replace(pattern, replacement);
  }
  return result;
}
