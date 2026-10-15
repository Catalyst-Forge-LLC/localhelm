/** No Node imports; shared by dashboard buttons and confirmation copy. */
export function packagePrivacyLabel(): string {
	return 'Remove private flag';
}

export function packagePrivacyHint(): string {
	return 'Removes private: true from the named release manifest, permitting npm publishing for this package. Other Publish checks still apply. This does not change GitHub repository visibility or publish anything. The edit stays local for you to review and commit. Cancel leaves the file unchanged.';
}
