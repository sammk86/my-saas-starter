import SettingsTabs from './settings-tabs';

export default function SettingsPage() {
  return (
    <section className="flex-1 p-4 lg:p-8">
      <h1 className="text-lg lg:text-2xl font-medium text-gray-900 mb-6">
        Settings
      </h1>
      <SettingsTabs />
    </section>
  );
}

