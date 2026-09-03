import { StyleSheet } from "react-native";
import type { ThemeTokens } from "./tokens";

export function createStyles(t: ThemeTokens) {
	return StyleSheet.create({
		screen: {
			flex: 1,
			backgroundColor: t.bg,
		},
		scrollContent: {
			padding: 20,
		},
		header: {
			fontSize: 28,
			fontWeight: "bold",
			color: t.text,
			marginBottom: 24,
		},
		card: {
			backgroundColor: t.card,
			borderRadius: 12,
			padding: 16,
			marginBottom: 16,
			borderWidth: 1,
			borderColor: t.border,
		},
		cardLast: {
			backgroundColor: t.card,
			borderRadius: 12,
			padding: 16,
			borderWidth: 1,
			borderColor: t.border,
		},
		label: {
			fontSize: 14,
			color: t.muted,
			marginBottom: 4,
		},
		value: {
			fontSize: 16,
			color: t.text,
			fontWeight: "500",
		},
		input: {
			backgroundColor: t.inputBg,
			borderWidth: 1,
			borderColor: t.border,
			borderRadius: 8,
			padding: 12,
			marginBottom: 16,
			fontSize: 16,
			color: t.text,
		},
		primaryButton: {
			backgroundColor: t.primary,
			padding: 14,
			borderRadius: 8,
			alignItems: "center",
		},
		primaryButtonText: {
			color: t.primaryText,
			fontSize: 16,
			fontWeight: "600",
		},
		linkButton: {
			marginTop: 16,
			alignItems: "center",
		},
		linkButtonText: {
			color: t.muted,
		},
		linkText: {
			fontWeight: "600",
		},
	});
}
