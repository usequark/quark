"use client";

export default function DeleteMediaButton({ action }) {
	return (
		<form action={action}>
			<button
				type="submit"
				className="text-[10px] text-danger hover:opacity-75 transition-opacity"
				onClick={(e) => {
					if (!confirm("Delete this media asset? This cannot be undone."))
						e.preventDefault();
				}}
			>
				Delete
			</button>
		</form>
	);
}
