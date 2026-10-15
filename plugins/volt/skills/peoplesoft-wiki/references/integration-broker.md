# PeopleSoft — Integration Broker Reference

Messaging, web services, and integration patterns for PeopleSoft.

---

## Integration Broker Architecture

```
EXTERNAL SYSTEM ←→ INTEGRATION GATEWAY ←→ INTEGRATION ENGINE ←→ APPLICATION
                        (WebLogic)           (App Server)         (PeopleCode/AE)
```

---

## Key Concepts

| Concept | Purpose |
|---------|---------|
| **Service** | Logical grouping of operations |
| **Service Operation** | Single integration point (message definition + handler) |
| **Message** | Data structure (XML schema based on records/rowsets) |
| **Handler** | PeopleCode that processes the message (OnRequest, OnNotify) |
| **Routing** | Defines where messages go (node, connector, transformation) |
| **Node** | Represents an external system endpoint |
| **Connector** | Transport mechanism (HTTP, FTP, JMS, SMTP, PeopleSoft) |
| **Transformation** | XSLT or Application Engine to reshape data |
| **Queue** | Asynchronous message queue for pub/sub |

---

## Service Operation Types

| Type | Pattern | Use Case |
|------|---------|----------|
| **Synchronous** | Request → Response (blocking) | Real-time lookups, validations |
| **Asynchronous** | Fire-and-forget with optional callback | Batch data feeds, notifications |
| **Pub/Sub** | Publisher sends; subscribers receive | Event broadcasting (hire, terminate) |
| **REST** | RESTful services (GET, POST, PUT, DELETE) | Modern integrations, mobile apps |

---

## REST Services (PeopleTools 8.55+)

### Delivered REST APIs

| Category | Endpoint Pattern | Operations |
|----------|-----------------|-----------|
| HCM | `/psofthr/` | Employee data, job data, compensation |
| FSCM | `/psoftfin/` | Journals, vouchers, POs, assets |
| Campus | `/psc/` | Student records, enrollment |
| Custom | `/custom/` | Developer-defined services |

### Creating Custom REST Service

1. Define Service in Integration Broker
2. Create Service Operation (type: REST)
3. Define URI template and HTTP method
4. Write handler (PeopleCode OnRequest)
5. Configure routing (any-to-local)
6. Set security (authentication, authorization)
7. Test via Integration Broker Service Monitor

---

## Common Integration Patterns

### Pattern 1: Inbound (External → PeopleSoft)

```
External System → HTTP POST → Integration Gateway → Service Operation → Handler PeopleCode → Component Interface / SQL
```

### Pattern 2: Outbound (PeopleSoft → External)

```
PeopleCode / App Engine → Publish Message → Integration Engine → Routing → Connector (HTTP) → External System
```

### Pattern 3: File-Based

```
External System → File (CSV/XML) → FTP/SFTP → File Layout → Component Interface or SQL
```

### Pattern 4: Batch Integration (App Engine)

```
Process Scheduler → Application Engine → Read staging table → Validate → Insert to PeopleSoft tables → Log results
```

---

## Security for Integrations

| Layer | Mechanism |
|-------|-----------|
| **Authentication** | Basic Auth, Certificate, WS-Security, OAuth (8.57+) |
| **Authorization** | Permission List on Service Operation |
| **Transport** | SSL/TLS (HTTPS mandatory for production) |
| **IP Filtering** | Gateway-level IP whitelist |
| **Audit** | Integration Broker Monitor logs all messages |
