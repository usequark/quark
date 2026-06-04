"use client";

import AdminImagePicker from "../../_components/AdminImagePicker";

export default function CoverImageField({
	label = "Cover Image",
	defaultValue = "",
	name = "coverImage",
	disabled = false,
	onChange,
}) {
	return (
		<AdminImagePicker
			label={label}
			name={name}
			defaultValue={defaultValue}
			disabled={disabled}
			onChange={onChange}
		/>
	);
}
