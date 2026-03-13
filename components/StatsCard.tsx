interface Props {
  icon: string;
  label: string;
  value: string | number;
  sublabel?: string;
}

export default function StatsCard({ icon, label, value, sublabel }: Props) {
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex flex-col gap-1">
      <p className="text-2xl">{icon}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-sm text-gray-400">{label}</p>
      {sublabel && <p className="text-xs text-gray-500">{sublabel}</p>}
    </div>
  );
}
