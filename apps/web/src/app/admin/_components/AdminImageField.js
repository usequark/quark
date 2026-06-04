"use client";

import AdminImagePicker from "./AdminImagePicker";

export default function AdminImageField({
	label,
	name,
	defaultValue = "",
	disabled = false,
}) {
	return (
		<AdminImagePicker
			label={label}
			name={name}
			defaultValue={defaultValue}
			disabled={disabled}
		/>
	);
}
