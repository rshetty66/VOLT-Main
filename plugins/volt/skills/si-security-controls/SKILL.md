---
name: si-security-controls
description: >
  This skill activates when the user discusses security, compliance, controls,
  SOX, audit, segregation of duties, SOD, access controls, role design,
  security architecture, identity management, SSO, authentication, authorization,
  encryption, data privacy, GDPR, CCPA, cybersecurity, risk management, or
  control frameworks across Oracle, SAP, Workday, or enterprise systems.
version: 1.0.0
---

# Security & Controls Lead — SI Delivery Excellence

Expert-level guidance for security, compliance, and controls in systems integration projects. Covers security architecture, access management, segregation of duties, audit compliance, and control frameworks across all major enterprise platforms.

---

## 1. Security Architecture Framework

### Defense in Depth

```
┌─────────────────────────────────────────┐
│           PERIMETER LAYER              │
│  Firewall, WAF, DDoS Protection        │
├─────────────────────────────────────────┤
│           NETWORK LAYER                │
│  Segmentation, VPN, Zero Trust         │
├─────────────────────────────────────────┤
│           APPLICATION LAYER            │
│  Authentication, Authorization, Input  │
├─────────────────────────────────────────┤
│           DATA LAYER                   │
│  Encryption, Masking, Classification   │
├─────────────────────────────────────────┤
│           ENDPOINT LAYER               │
│  EDR, Patching, Device Management      │
├─────────────────────────────────────────┤
│           IDENTITY LAYER               │
│  IAM, MFA, PAM, Lifecycle Management   │
└─────────────────────────────────────────┘
```

### Zero Trust Architecture

**Principles:**
1. Never trust, always verify
2. Assume breach
3. Verify explicitly
4. Use least privilege access
5. Assume compromised credentials

**Implementation:**
- Identity verification for every access request
- Device health checks
- Continuous monitoring
- Micro-segmentation

---

## 2. Identity and Access Management (IAM)

### Identity Lifecycle

```
Joiner → Mover → Leaver

Onboard Transfer Offboard
```

**Joiner Process:**
- Identity proofing
- Account provisioning
- Role assignment
- Access certification

**Mover Process:**
- Role change request
- Access review
- Revoke old access
- Grant new access

**Leaver Process:**
- Termination notification
- Immediate access revocation
- Data archival
- Account deactivation

### Authentication Methods

| Method | Security Level | Use Case |
|--------|---------------|----------|
| Password | Low | Legacy, low-risk |
| Password + MFA | Medium-High | Standard users |
| Certificate | High | Service accounts, API |
| Biometric | High | Mobile, privileged |
| FIDO2/WebAuthn | Very High | High-security environments |
| Hardware Token | Very High | Admin, privileged access |

### Authorization Models

**RBAC (Role-Based Access Control):**
```
User → Role → Permission → Resource
```
- Simple to manage
- Role explosion risk
- Best for stable organizations

**ABAC (Attribute-Based Access Control):**
```
User Attributes + Resource Attributes + Environment → Decision
```
- Context-aware
- Fine-grained
- Complex to implement

**PBAC (Policy-Based Access Control):**
- Centralized policies
- Business-friendly rules
- Dynamic evaluation

### Privileged Access Management (PAM)

**Components:**
| Component | Purpose |
|-----------|---------|
| Password Vault | Secure credential storage |
| Session Recording | Audit privileged sessions |
| Privileged Elevation | Just-in-time admin access |
| Command Filtering | Restrict dangerous commands |

**Privileged Account Types:**
- Emergency/break-glass accounts
- Service accounts
- Admin accounts
- Application accounts

---

## 3. Segregation of Duties (SOD)

### SOD Principles

**The Four-Eyes Principle:**
No single person should control all aspects of a critical transaction.

**Compensating Controls:**
When SOD is not possible, implement:
- Manager review/approval
- Audit trail monitoring
- Regular reconciliation
- Exception reporting

### SOD Matrix by Process

**Procure-to-Pay:**
| Function | Conflict With | Risk |
|----------|---------------|------|
| Create Vendor | Approve Vendor | Fictitious vendor |
| Create PO | Approve PO | Unauthorized purchases |
| Receive Goods | Approve Invoice | Fraudulent payment |
| Approve Invoice | Process Payment | Duplicate payment |

**Order-to-Cash:**
| Function | Conflict With | Risk |
|----------|---------------|------|
| Create Customer | Approve Credit | Bad debt exposure |
| Create Invoice | Apply Cash | Lapping scheme |
| Write-off | Approve Write-off | Concealment |

**Record-to-Report:**
| Function | Conflict With | Risk |
|----------|---------------|------|
| Create Journal | Approve Journal | Fraudulent entries |
| Reconcile Account | Approve Rec | Concealed errors |
| Post Close | Open Period | Unauthorized changes |

### SOD Analysis by Platform

#### Oracle ERP Cloud

**Tools:**
- Oracle Advanced Controls (part of GRC)
- Custom SOD reports
- Role analysis

**Common SOD Violations:**
```
Role A: AP Invoice Entry + AP Payment Processing
Role B: GL Journal Entry + GL Period Close
Role C: Vendor Creation + Invoice Approval
```

**Remediation:**
- Split roles
- Add approval workflows
- Implement monitoring

#### SAP S/4HANA

**Tools:**
- SAP GRC Access Control
- SOD Risk Analysis
- Emergency Access Management

**Common SOD Violations:**
```
Transaction FB50 (Post Doc) + FB08 (Reverse)
ME21N (Create PO) + ME29N (Release PO)
MIRO (Enter Invoice) + F110 (Payment Run)
```

**Authorization Objects to Review:**
- F_BKPF_BUK (Accounting document)
- F_BKPF_GSB (Business area)
- M_EINK_FRG (Purchasing release)

#### Workday

**Tools:**
- Built-in SOD reports
- Domain security analysis
- Business process security

**SOD Configuration:**
- Domain security policies
- Business process policies
- Segmented security

---

## 4. Control Frameworks

### SOX 404 Controls

**IT General Controls (ITGCs):**

| Control Area | Control Objective | Testing Approach |
|--------------|-------------------|------------------|
| **Access** | Only authorized users have access | User access reviews |
| **Change Management** | Changes are authorized and tested | Change ticket review |
| **Computer Operations** | Batch jobs run as scheduled | Job schedule review |
| **Program Development** | Development follows SDLC | Project documentation |

**Application Controls:**

| Control Type | Example |
|--------------|---------|
| **Input Controls** | Validations, mandatory fields, drop-downs |
| **Processing Controls** | Calculations, balancing, sequencing |
| **Output Controls** | Report distribution, access restrictions |
| **Interface Controls** | Reconciliation, error handling |

### COSO Framework

**Components:**
```
┌─────────────────────────────────────────┐
│        INTERNAL ENVIRONMENT            │
│  Tone at top, org structure, ethics    │
├─────────────────────────────────────────┤
│           RISK ASSESSMENT              │
│  Identify, analyze risks               │
├─────────────────────────────────────────┤
│         CONTROL ACTIVITIES             │
│  Policies, procedures, SOD             │
├─────────────────────────────────────────┤
│      INFORMATION & COMMUNICATION       │
│  Reporting, documentation              │
├─────────────────────────────────────────┤
│       MONITORING ACTIVITIES            │
│  Ongoing, separate evaluations         │
└─────────────────────────────────────────┘
```

### NIST Cybersecurity Framework

**Functions:**
| Function | Description | Activities |
|----------|-------------|------------|
| **Identify** | Asset management | Inventory, risk assessment |
| **Protect** | Safeguards | Access control, training |
| **Detect** | Monitoring | Continuous monitoring, anomalies |
| **Respond** | Incident handling | Response planning, communications |
| **Recover** | Resilience | Recovery planning, improvements |

---

## 5. Data Privacy & Protection

### GDPR Compliance

**Key Requirements:**
| Requirement | Implementation |
|-------------|----------------|
| **Lawful Basis** | Consent, contract, legal obligation |
| **Data Minimization** | Collect only necessary data |
| **Purpose Limitation** | Use only for stated purposes |
| **Accuracy** | Keep data up to date |
| **Storage Limitation** | Retain only as long as needed |
| **Integrity/Confidentiality** | Security measures |
| **Accountability** | Documentation, DPO |

**Data Subject Rights:**
- Right to be informed
- Right of access
- Right to rectification
- Right to erasure ("right to be forgotten")
- Right to restrict processing
- Right to data portability
- Right to object
- Rights related to automated decision-making

### CCPA Compliance

**Consumer Rights:**
- Know what personal information is collected
- Know if personal information is sold/disclosed
- Say no to sale of personal information
- Access personal information
- Equal service and price (non-discrimination)

### Data Classification

| Classification | Definition | Handling |
|----------------|------------|----------|
| **Public** | No harm if disclosed | Standard controls |
| **Internal** | Business use only | Access controls |
| **Confidential** | Significant harm if disclosed | Encryption, need-to-know |
| **Restricted** | Severe harm if disclosed | Highest controls, logging |

### Data Encryption

**Encryption at Rest:**
| Layer | Method | Use Case |
|-------|--------|----------|
| Database | TDE (Transparent Data Encryption) | Database files |
| Application | Field-level encryption | Sensitive fields |
| File System | Volume encryption | Unstructured data |
| Backup | Backup encryption | Backup media |

**Encryption in Transit:**
| Protocol | Use Case |
|----------|----------|
| TLS 1.2+ | Web traffic, APIs |
| IPSec | Network-level VPN |
| SSH | Administrative access |
| SFTP | File transfers |

---

## 6. Platform-Specific Security

### Oracle Cloud Security

**Identity and Access:**
- Oracle Cloud Infrastructure IAM
- Identity Domains
- Policies and compartments
- Federation (SAML, OIDC)

**Oracle ERP Cloud Security:**
- Role-based access control
- Duty roles vs. job roles
- Data roles (data access sets)
- Security console

**Key Security Reports:**
- User and role access
- Audit reports
- Sign-on audit
- Data access audit

### SAP Security

**Authorization Concept:**
```
User → Profile/Role → Authorization Object → Field → Value
```

**Key Components:**
| Component | Purpose |
|-----------|---------|
| **Authorization Object** | Group of related permissions |
| **Authorization Field** | Specific permission attribute |
| **Role** | Collection of authorizations |
| **Profile** | Technical container for authorizations |

**SU24 (Authorization Check):**
- Maintains default authorization values per transaction
- Critical for role design

**PFCG (Role Maintenance):**
- Create and modify roles
- Generate profiles
- Assign users

### Workday Security

**Security Framework:**
| Element | Description |
|---------|-------------|
| **Domain** | Functional areas (e.g., Payroll, Benefits) |
| **Security Policy** | Access rules for domains |
| **Functional Area** | Grouping of domains |
| **User-Based Security** | Direct user assignment |
| **Role-Based Security** | Access through roles |

**Security Groups:**
- User-based
- Role-based
- Level-based
- Integration-based

**Business Process Security:**
- Step-level security
- Approval chains
- Condition rules

---

## 7. Audit & Compliance

### Audit Trail Requirements

**What to Log:**
| Event Type | Data Elements |
|------------|---------------|
| **Authentication** | User ID, timestamp, success/failure, source IP |
| **Authorization** | Resource accessed, action, result |
| **Data Changes** | Old value, new value, who, when |
| **Administrative** | Config changes, user changes, role changes |
| **System Events** | Startup, shutdown, errors |

**Log Retention:**
- SOX: 7 years
- GDPR: Duration of processing + statute of limitations
- PCI DSS: 1 year (hot), 3 years (archive)

### Control Testing

**Design Effectiveness:**
- Is the control designed properly?
- Does it address the risk?
- Is it documented?

**Operating Effectiveness:**
- Is the control operating?
- Is it consistent?
- Is there evidence?

**Testing Methods:**
| Method | Description |
|--------|-------------|
| **Inquiry** | Ask control owner |
| **Observation** | Watch control being performed |
| **Inspection** | Examine documentation |
| **Reperformance** | Independently execute control |
| **Analytics** | Analyze trends and patterns |

### Continuous Auditing

**Automated Control Monitoring:**
- SOD violation detection
- Privileged access monitoring
- Failed login attempts
- After-hours access
- Unusual transaction patterns

**Key Risk Indicators (KRIs):**
| KRI | Threshold | Action |
|-----|-----------|--------|
| Failed logins | >5 per user/hour | Lock account, investigate |
| Off-hours access | >3 SD from mean | Review, verify |
| SOD violations | Any new | Immediate remediation |
| Emergency access | >5 per month | Review necessity |

---

## 8. Security Testing

### Security Testing Types

| Type | Purpose | Tools |
|------|---------|-------|
| **Vulnerability Scan** | Find known vulnerabilities | Nessus, Qualys, OpenVAS |
| **Penetration Test** | Exploit vulnerabilities | Metasploit, Cobalt Strike |
| **SAST** | Source code analysis | SonarQube, Checkmarx |
| **DAST** | Runtime application testing | OWASP ZAP, Burp Suite |
| **SCA** | Third-party component analysis | Snyk, Black Duck |
| **IAST** | Interactive application testing | Contrast, Veracode |

### Secure Development Lifecycle

**Requirements Phase:**
- Security requirements
- Threat modeling
- Privacy impact assessment

**Design Phase:**
- Secure architecture review
- Attack surface analysis
- Data flow diagrams

**Development Phase:**
- Secure coding standards
- Code reviews
- Static analysis

**Testing Phase:**
- Dynamic analysis
- Penetration testing
- Fuzzing

**Deployment Phase:**
- Hardening
- Configuration review
- Final security scan

**Operations Phase:**
- Monitoring
- Incident response
- Patch management

---

## Quick Reference: Security Checklist

**Access Management:**
- [ ] User access reviews completed quarterly
- [ ] Terminated user access revoked within 24 hours
- [ ] Privileged access monitored and logged
- [ ] Service accounts secured and rotated
- [ ] MFA enabled for all users

**Data Protection:**
- [ ] Data classified
- [ ] Encryption at rest enabled
- [ ] Encryption in transit enforced
- [ ] Data masking in non-production
- [ ] Backup encryption

**Audit & Compliance:**
- [ ] Audit logging enabled
- [ ] Logs retained per policy
- [ ] SOD violations monitored
- [ ] ITGCs documented and tested
- [ ] Security incidents tracked

**Platform Security:**
- [ ] Security patches applied
- [ ] Default passwords changed
- [ ] Unnecessary services disabled
- [ ] Security baselines applied
- [ ] Monitoring configured
