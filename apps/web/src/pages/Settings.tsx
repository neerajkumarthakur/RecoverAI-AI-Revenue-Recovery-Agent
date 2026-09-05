import { Card, CardHeader, CardContent } from '../components/ui/Card';

const POLICIES = [
  { label: 'Maximum automated attempts', value: '2' },
  { label: 'Maximum recovery amount', value: '₹10,000' },
  { label: 'Recovery window', value: '72 hours' },
  { label: 'Minimum AI confidence', value: '60%' },
  { label: 'Payment Link recovery', value: 'Enabled' },
  { label: 'Approval mode', value: 'Always Manual' },
];

export function Settings() {
  return (
    <div className="p-8 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
        <p className="text-gray-500 text-sm mt-1">Recovery policy configuration</p>
      </div>

      <Card>
        <CardHeader>
          <h3 className="font-semibold text-gray-900">Recovery Policy</h3>
        </CardHeader>
        <CardContent>
          <dl className="divide-y divide-gray-100">
            {POLICIES.map((p) => (
              <div key={p.label} className="flex items-center justify-between py-3">
                <dt className="text-sm text-gray-600">{p.label}</dt>
                <dd className="text-sm font-semibold text-gray-900">{p.value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
        Settings are read-only in this demo.
      </div>
    </div>
  );
}
