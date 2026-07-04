import AiChatShell from "./_components/AiChatShell";

export const metadata = {
	title: "AI Assistant",
};

export default function AiPage() {
	return (
		<div className="-m-4 lg:-m-6 h-[calc(100%+2rem)] lg:h-[calc(100%+3rem)] flex overflow-hidden">
			<AiChatShell />
		</div>
	);
}
