import LoaderContainer from '@/components/calculators/LoaderContainer';

export default function PlateLoaderPage() {
    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            overflow: 'hidden'
        }}>
            <LoaderContainer />
        </div>
    );
}
