export function accountTypeFromSettings(settingsRow) {
  const settings = settingsRow && settingsRow.settings;
  const onboarding = settings && settings.onboarding;
  const value = onboarding && onboarding.accountType;
  return typeof value === 'string' && value.trim() ? value.trim().toLowerCase() : 'default';
}
