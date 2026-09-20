const { withEntitlementsPlist } = require('expo/config-plugins');

/**
 * Disables aps-environment entitlement on iOS so that production builds can succeed
 * with provisioning profiles that do not have Push Notifications capability enabled on Apple Developer portal.
 */
module.exports = function withoutApsEnvironment(config) {
  return withEntitlementsPlist(config, (mod) => {
    delete mod.modResults['aps-environment'];
    return mod;
  });
};
