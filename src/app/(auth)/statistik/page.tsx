import { StatistikDashboard } from '@/components/statistik/statistik-dashboard';

export const metadata = {
    title: 'Dashboard Statistik t-SEMAR',
    description: 'Sebaran nilai akhir peserta pelatihan evaluator AKIP.',
};

export default function StatistikPage() {
    return <StatistikDashboard />;
}
