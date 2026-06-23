# Audit Integrity

Kernel permission decisions and privileged operation outcomes require append-only audit
records containing actor context, evaluated constitutional authority, action, target,
reason, result, timestamp, correlation ID, and integrity metadata.

The Gate 1 local adapter serializes writes, redacts sensitive details, and links each
record to the previous record with SHA-256. It verifies the complete chain before every
append and refuses further writes after malformed data, a broken link, or a hash
mismatch is detected. Permission evaluation fails closed when its audit record cannot
be persisted.

The local adapter is a development and verification implementation. Workstream 6
defines the transactional persistence boundary; production archival, replication,
legal hold, and retention remain blocked on approved hosting and policy decisions.
