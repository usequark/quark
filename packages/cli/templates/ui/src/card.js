import React from "react";

export const Card = ({ className, children, ...props }) => {
	const baseStyles = "bg-white rounded-lg shadow-md p-4";

	return React.createElement(
		"div",
		{
			className: `${baseStyles} ${className || ""}`,
			...props,
		},
		children,
	);
};
