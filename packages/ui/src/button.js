import React from "react";

export const Button = ({ variant = "primary", className, ...props }) => {
	const baseStyles = "px-4 py-2 rounded-md font-medium transition-colors";
	const variants = {
		primary: "bg-blue-600 text-white hover:bg-blue-700",
		secondary: "bg-gray-200 text-gray-900 hover:bg-gray-300",
	};

	return React.createElement(
		"button",
		{
			type: "button",
			className: `${baseStyles} ${variants[variant]} ${className || ""}`,
			...props,
		},
		props.children,
	);
};
