export default function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="h-8 w-8 rounded-full border-4 border-brand-400 border-t-accent-500 animate-spin" />
    </div>
  );
}
