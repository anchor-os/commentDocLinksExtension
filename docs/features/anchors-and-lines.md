# Anchors and Lines

References can identify semantic anchors and, where supported, explicit line locations.

Resolution distinguishes valid anchors, missing anchors, and invalid lines. Navigation reveals the resolved position; diagnostics report only proven failures.

A missing anchor does not block navigation: the resolved position falls back to an unanchored match, or to the start of the file, and the result is flagged as unanchored so callers can tell an exact anchor hit from a fallback.
