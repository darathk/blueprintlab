import LoaderContainer from '@/components/calculators/LoaderContainer';

export default function DashboardPlateLoaderPage() {
    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            overflow: 'hidden',
            margin: '0 -1.5rem'
        }}>
            <LoaderContainer />
        </div>
    );
}
