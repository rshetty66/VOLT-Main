---
name: si-integration-lead
description: >
  This skill activates when the user discusses system integration, APIs,
  middleware, MuleSoft, Dell Boomi, Azure Integration Services, AWS AppFlow,
  Oracle Integration Cloud, SAP Integration Suite, web services, REST, SOAP,
  event-driven architecture, EDA, microservices, API management, data
  integration, or interface development across enterprise platforms.
version: 1.0.0
---

# Integration Lead — SI Delivery Excellence

Expert-level guidance for leading integration workstreams in systems integration projects. Covers API design, middleware platforms, integration patterns, and event-driven architecture across all major enterprise systems.

---

## 1. Integration Architecture Patterns

### Pattern 1: Point-to-Point

**Characteristics:**
- Direct connections between systems
- Simple, quick to implement
- Becomes complex at scale

**Best For:**
- 2-3 systems
- Simple data flows
- Rapid prototyping

**Anti-pattern Warning:**
- "Spaghetti integration" at enterprise scale
- Difficult to maintain
- No central visibility

### Pattern 2: Hub-and-Spoke

**Characteristics:**
- Central integration hub
- All systems connect to hub
- Common transformation logic

**Architecture:**
```
    System A

System B ←→ Integration Hub ←→ System C

    System D
```

**Best For:**
- 5-15 systems
- Common data transformations
- Centralized monitoring

**Tools:** MuleSoft, Dell Boomi, Oracle OIC, Azure Logic Apps

### Pattern 3: Enterprise Service Bus (ESB)

**Characteristics:**
- Message routing
- Protocol transformation
- Service orchestration
- Advanced mediation

**Architecture:**
```
┌─────────────────────────────────────────┐
│           Enterprise Service Bus        │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │ Routing │ │Transform│ │Orchestr │   │
│  └─────────┘ └─────────┘ └─────────┘   │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │Security │ │Monitoring│ │Mediation│  │
│  └─────────┘ └─────────┘ └─────────┘   │
└─────────────────────────────────────────┘
```

**Best For:**
- Large enterprises
- Complex routing needs
- Multiple protocols

**Tools:** MuleSoft, IBM App Connect, WSO2, TIBCO

### Pattern 4: API-Led Connectivity

**Characteristics:**
- System APIs (raw connectivity)
- Process APIs (orchestration)
- Experience APIs (user-specific)

**Architecture:**
```
Experience APIs (Web, Mobile, Partner)

Process APIs (Business processes)

System APIs (ERP, CRM, DB)
```

**Best For:**
- Microservices architecture
- Reusable services
- Digital transformation

**Tools:** MuleSoft (Anypoint Platform), Apigee, Azure API Management

### Pattern 5: Event-Driven Architecture (EDA)

**Characteristics:**
- Asynchronous communication
- Event producers and consumers
- Loose coupling
- Real-time responsiveness

**Architecture:**
```
Event Producers → Event Bus → Event Consumers

               Kafka/Kinesis/EventBridge
```

**Best For:**
- Real-time requirements
- High throughput
- Microservices
- IoT scenarios

**Tools:** Apache Kafka, AWS EventBridge, Azure Event Grid, Confluent

---

## 2. Integration Protocols & Standards

### REST APIs

**Design Principles:**
- Resource-based URIs
- HTTP verbs (GET, POST, PUT, DELETE, PATCH)
- JSON payloads
- Stateless communication

**Best Practices:**
```
URI Design:
 /api/v1/customers
 /api/v1/customers/{id}/orders
 /api/v1/getCustomers
 /api/v1/customerData

HTTP Status Codes:
200 - OK
201 - Created
400 - Bad Request
401 - Unauthorized
404 - Not Found
500 - Internal Server Error
```

**Versioning:**
- URL: /api/v1/, /api/v2/
- Header: Accept: application/vnd.api+json;version=1
- Query: ?version=1

### SOAP Web Services

**Characteristics:**
- XML-based
- WSDL contracts
- WS-* standards
- Strong typing

**Still Relevant For:**
- Legacy system integration
- Financial services (SWIFT)
- Healthcare (HL7)
- Strict contract requirements

### GraphQL

**Characteristics:**
- Client-specified queries
- Single endpoint
- Reduced over-fetching
- Strong typing

**Best For:**
- Mobile applications
- Complex data relationships
- Frontend-driven development

### OData

**Characteristics:**
- RESTful standard
- Query capabilities ($filter, $select, $expand)
- Metadata-driven
- CRUD operations

**Supported By:**
- SAP
- Microsoft
- Oracle
- Salesforce

### gRPC

**Characteristics:**
- Protocol Buffers
- High performance
- Streaming support
- Binary serialization

**Best For:**
- Microservices communication
- Low-latency requirements
- Polyglot environments

---

## 3. Middleware Platforms

### MuleSoft

**Platform Components:**
| Component | Purpose |
|-----------|---------|
| Anypoint Studio | Design and development |
| Anypoint Platform | Runtime, management, monitoring |
| CloudHub | Cloud deployment |
| Runtime Fabric | On-premises/container deployment |
| Exchange | Asset repository |
| API Manager | API governance |

**Key Capabilities:**
- API-led connectivity
- Pre-built connectors (300+)
- DataWeave transformation
- Flow orchestration
- API management

**Common Connectors:**
- SAP, Oracle, Salesforce
- Database (JDBC, MongoDB)
- Cloud (AWS, Azure, GCP)
- Protocols (HTTP, FTP, JMS)

### Dell Boomi

**Platform Components:**
| Component | Purpose |
|-----------|---------|
| AtomSphere | Integration platform |
| Atom | Runtime engine |
| Molecule | Clustered runtime |
| Atom Cloud | Cloud runtime |
| Boomi Flow | Workflow |
| Master Data Hub | MDM |

**Key Capabilities:**
- Visual development
- Pre-built connectors
- Boomi Suggest (AI-assisted mapping)
- Master data hub
- B2B/EDI management

**Strengths:**
- Ease of use
- Quick time to value
- Strong EDI support
- MDM integration

### Azure Integration Services

**Services Matrix:**
| Service | Purpose | Use Case |
|---------|---------|----------|
| **Logic Apps** | Workflow orchestration | Business process automation |
| **API Management** | API gateway | API publishing and governance |
| **Service Bus** | Messaging | Async communication |
| **Event Grid** | Event routing | Event-driven architecture |
| **Data Factory** | Data integration | ETL/ELT pipelines |
| **Functions** | Serverless compute | Event processing |

**Logic Apps:**
- Visual designer
- 400+ connectors
- Enterprise integration pack
- B2B capabilities

**API Management:**
- API gateway
- Developer portal
- Policy enforcement
- Analytics

### Oracle Integration Cloud (OIC)

**Components:**
| Component | Purpose |
|-----------|---------|
| Integration | Application integration |
| Process | Business process automation |
| Insight | Real-time analytics |
| Visual Builder | Low-code apps |

**Key Capabilities:**
- Pre-built adapters (Oracle + 3rd party)
- Process automation
- File-based integrations
- Real-time and batch

**Oracle-Specific:**
- ERP Cloud adapter
- EPM Cloud adapter
- HCM Cloud adapter
- CX Cloud adapter

### SAP Integration Suite

**Components:**
| Component | Purpose |
|-----------|---------|
| Cloud Integration (CPI) | iPaaS |
| API Management | API gateway |
| Event Mesh | Event streaming |
| Open Connectors | 3rd party connectivity |
| Data Intelligence | Data integration |

**Integration Advisor:**
- ML-based mapping recommendations
- Message implementation guidelines
- B2B integration

**SAP-Specific:**
- Deep SAP connectivity
- IDoc support
- RFC/BAPI calls
- OData provisioning

### AWS AppFlow / Integration

**Services:**
| Service | Purpose |
|---------|---------|
| **AppFlow** | SaaS integration |
| **EventBridge** | Serverless event bus |
| **Step Functions** | Workflow orchestration |
| **API Gateway** | API management |
| **AppSync** | GraphQL |

**AppFlow:**
- No-code SaaS integrations
- Salesforce, SAP, Zendesk
- Data transformation
- Scheduled or event-driven

---

## 4. Integration Design Patterns

### Synchronous vs. Asynchronous

| Aspect | Synchronous | Asynchronous |
|--------|-------------|--------------|
| Response | Immediate | Delayed |
| Coupling | Tight | Loose |
| Reliability | Lower (timeouts) | Higher (queue-based) |
| Complexity | Simpler | More complex |
| Use Case | Queries, validation | Processing, notifications |

**Decision Framework:**
```
Does caller need immediate result?
├── YES → Synchronous
│         └── But consider timeout handling
└── NO → Asynchronous
          ├── Message Queue (reliable delivery)
          └── Event Stream (multiple consumers)
```

### Request-Reply Pattern

**Flow:**
```
Client → Request → Service → Reply → Client
```

**Implementation:**
- HTTP/REST (synchronous)
- JMS Request-Reply (asynchronous)
- Correlation ID for matching

### Fire-and-Forget Pattern

**Flow:**
```
Producer → Message → Queue → Consumer
```

**Use Cases:**
- Notifications
- Logging
- Audit trails
- Background processing

### Publish-Subscribe Pattern

**Flow:**
```
Publisher → Topic → [Subscriber A]
                → [Subscriber B]
                → [Subscriber C]
```

**Use Cases:**
- Event broadcasting
- Real-time updates
- Decoupled systems

### Circuit Breaker Pattern

**Purpose:** Prevent cascade failures

**States:**
```
CLOSED → (failure threshold) → OPEN → (timeout) → HALF-OPEN

  └────────────── (success) ─────────────────────┘
```

**Implementation:**
- Monitor failure rate
- Open circuit when threshold exceeded
- Fail fast when open
- Test recovery in half-open

### Idempotency Pattern

**Purpose:** Safe retry without side effects

**Approaches:**
1. **Idempotency Key**: Client provides unique key
2. **Resource State Check**: Verify before action
3. **Natural Idempotency**: PUT vs POST

**Implementation:**
```
POST /payments
Header: Idempotency-Key: abc-123

Server:
- Check if key processed
- If yes → return cached response
- If no → process and store
```

---

## 5. API Management

### API Lifecycle

```
Design → Build → Test → Deploy → Publish → Monitor → Retire

  Spec    Code   Unit   CI/CD    Portal   Analytics
```

### API Gateway Functions

| Function | Purpose |
|----------|---------|
| **Routing** | Route to appropriate backend |
| **Transformation** | Protocol/format conversion |
| **Security** | Auth, rate limiting, throttling |
| **Caching** | Improve performance |
| **Monitoring** | Logging, analytics |
| **Versioning** | Manage API versions |

### API Security

**Authentication:**
| Method | Use Case |
|--------|----------|
| API Key | Simple, internal |
| OAuth 2.0 | User delegation, 3rd party |
| JWT | Stateless, microservices |
| mTLS | High security, B2B |
| Basic Auth | Legacy, internal |

**Authorization:**
- RBAC (Role-Based Access Control)
- ABAC (Attribute-Based Access Control)
- OAuth scopes
- Custom policies

**Rate Limiting:**
- Per API key
- Per user
- Per IP
- Tiered (Free/Premium/Enterprise)

### API Versioning Strategy

**Approaches:**
1. **URL**: `/api/v1/customers`, `/api/v2/customers`
2. **Header**: `Accept: application/vnd.company.v1+json`
3. **Query**: `/api/customers?version=1`

**Deprecation Strategy:**
- Sunset policy (6-12 months notice)
- Version support matrix
- Migration guides
- Dual-running period

---

## 6. B2B / EDI Integration

### Common EDI Standards

| Standard | Industry | Message Types |
|----------|----------|---------------|
| **X12** | North America | 850 (PO), 810 (Invoice), 856 (ASN) |
| **EDIFACT** | Europe, Global | ORDERS, INVOIC, DESADV |
| **XML** | Cross-industry | cXML, ebXML |
| **JSON** | Modern APIs | Custom schemas |
| **Flat File** | Legacy | CSV, fixed-width |

### B2B Integration Patterns

**Direct EDI:**
```
Company A EDI ←→ VAN ←→ Company B EDI
```

**AS2 (Applicability Statement 2):**
- HTTP-based
- Digital signatures
- Encryption
- MDN receipts

**SFTP / FTPS:**
- File-based exchange
- Secure protocols
- Batch processing

### Mappings and Transformations

**Typical EDI Mapping:**
```
X12 850 (Purchase Order)
├── BEG (Beginning Segment)
│   └── PO Number → OrderID
├── N1 (Name)
│   └── Supplier → VendorCode
├── PO1 (Baseline Item)
│   ├── Product Code → SKU
│   ├── Quantity → Qty
│   └── Price → UnitPrice
```

---

## 7. Integration Testing

### Testing Pyramid

```
    /\
   /  \  End-to-End Tests
  /____\
 /      \ Integration Tests
/________\
          Unit Tests
```

### Testing Types

| Type | Scope | Tools |
|------|-------|-------|
| **Unit** | Individual components | JUnit, NUnit, MUnit |
| **Contract** | API contracts | Pact, Spring Cloud Contract |
| **Integration** | Component interaction | Postman, SoapUI |
| **End-to-End** | Full flow | Selenium, custom |
| **Performance** | Load, stress | JMeter, Gatling, K6 |
| **Security** | Vulnerabilities | OWASP ZAP, Burp Suite |

### Test Data Management

**Strategies:**
1. **Static Test Data**: Predefined datasets
2. **Synthetic Data**: Generated realistic data
3. **Production Subset**: Masked production data
4. **Data Virtualization**: Real-time data copies

### Error Handling & Resilience

**Retry Strategies:**
| Strategy | Use Case |
|----------|----------|
| **Fixed Interval** | Simple, predictable |
| **Exponential Backoff** | Network issues, rate limiting |
| **Circuit Breaker** | Cascading failure prevention |
| **Dead Letter Queue** | Unprocessable messages |

**Monitoring:**
- Success/error rates
- Latency (p50, p95, p99)
- Throughput
- Circuit breaker state

---

## 8. Integration Governance

### API Catalog / Developer Portal

**Components:**
- API documentation
- Try-it functionality
- SDKs and code samples
- Forums and support
- Analytics dashboard

### Integration Standards

**Naming Conventions:**
```
APIs: /api/v1/resource-name
Flows: [System]_[Direction]_[Object]_[Action]
Queues: SYSTEM.OBJECT.ACTION
```

**Documentation Standards:**
- OpenAPI (Swagger) for REST
- WSDL for SOAP
- AsyncAPI for events
- README for custom

### Integration Monitoring

**Key Metrics:**
| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| Availability | % uptime | <99.9% |
| Response Time | Average latency | >2s |
| Error Rate | % failed requests | >1% |
| Throughput | Requests per minute | Drop >20% |
| Queue Depth | Pending messages | >1000 |

**Observability:**
- Distributed tracing
- Log aggregation
- Metrics collection
- Alerting

---

## Quick Reference: Platform Selection by Use Case

| Use Case | Recommended Platform | Rationale |
|----------|---------------------|-----------|
| API-led integration | MuleSoft | Best-in-class API management |
| EDI/B2B heavy | Dell Boomi | Strong EDI capabilities |
| Microsoft ecosystem | Azure Integration | Native Azure integration |
| Oracle ecosystem | Oracle OIC | Pre-built Oracle adapters |
| SAP ecosystem | SAP Integration Suite | Deep SAP connectivity |
| AWS-centric | AWS AppFlow + EventBridge | Serverless, cost-effective |
| Event streaming | Confluent/Kafka | Best streaming platform |
| Low-code rapid | Zapier/Make | Quick, simple integrations |
