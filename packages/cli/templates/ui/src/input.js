import React from "react";

export const Input = ({ className, ...props }) => {
	const baseStyles =
		"px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500";

	return React.createElement("input", {
		className: `${baseStyles} ${className || ""}`,
		...props,
	});
};
