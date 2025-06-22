# SECURITY CHECKLIST FOR AI DEVELOPMENT

### Input Validation Requirements (NON-NEGOTIABLE)
- [ ] **All user inputs** must be validated using strict schemas
- [ ] **API parameters** must be validated against expected types
- [ ] **Message payloads** must be validated before processing
- [ ] **Database queries** must use parameterized statements
- [ ] **File uploads** must be scanned and validated

### Authentication & Authorization
- [ ] **All endpoints** must require authentication
- [ ] **Role-based access** must be implemented
- [ ] **Token validation** must check issuer and audience
- [ ] **Session timeouts** must be enforced
- [ ] **Password policies** must meet requirements

### Data Protection
- [ ] **PII data** must be encrypted at rest
- [ ] **Sensitive data** must be masked in logs
- [ ] **Data retention** policies must be followed
- [ ] **Data exports** must be audited
- [ ] **Backup encryption** must be enabled

### Secure Communication
- [ ] **TLS 1.2+** must be enforced
- [ ] **HSTS headers** must be implemented
- [ ] **CORS policies** must be restrictive
- [ ] **API keys** must be rotated regularly
- [ ] **WebSockets** must use wss:// protocol

### Error Handling Security
- [ ] **Error messages** must not reveal system details
- [ ] **Stack traces** must not be exposed to users
- [ ] **Log files** must not contain sensitive data
- [ ] **Rate limiting** must be implemented
- [ ] **Circuit breakers** must be configured

### Dependency Security
- [ ] **Dependencies** must be scanned for vulnerabilities
- [ ] **Outdated packages** must be updated
- [ ] **License compliance** must be verified
- [ ] **Container images** must be scanned
- [ ] **Build pipelines** must include security checks

### Monitoring & Alerting
- [ ] **Security events** must be logged
- [ ] **Anomaly detection** must be enabled
- [ ] **Failed logins** must trigger alerts
- [ ] **Brute force attempts** must be blocked
- [ ] **Security incidents** must be reported

### Secure Development Practices
- [ ] **Code reviews** must include security checks
- [ ] **Secrets** must not be hardcoded
- [ ] **Environment variables** must be used for configuration
- [ ] **Security headers** must be implemented
- [ ] **Security testing** must be part of CI/CD

### Incident Response
- [ ] **Incident response plan** must be documented
- [ ] **Security contacts** must be identified
- [ ] **Forensic capabilities** must be available
- [ ] **Backup restoration** must be tested
- [ ] **Post-mortems** must be conducted