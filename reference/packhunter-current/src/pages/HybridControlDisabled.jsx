/**
 * HybridControlDisabled — maintenance stub mounted in place of
 * HybridControl while the page is broken (SQL: column p.pinned does not exist).
 *
 * Rendered by /admin/hybrid-control. Issues ZERO data fetches.
 * The nav entry is hidden until the upstream schema/query is fixed.
 */

import MaintenanceBanner from '../components/MaintenanceBanner';

export default function HybridControlDisabled() {
  return (
    <MaintenanceBanner
      title="Hybrid Control — under repair"
      message="This page is temporarily unavailable due to a schema compatibility issue. Fleet Health still reflects current hunt status."
    />
  );
}
