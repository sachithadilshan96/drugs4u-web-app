import { useParams } from 'react-router-dom';

export default function CustomerView() {
    const { id } = useParams();

    return (
        <div>
            <h1 className="text-2xl font-semibold tracking-tight">Customer #{id}</h1>
            <p className="mt-2 text-sm text-muted-foreground">View profile, medication history, and verification status.</p>
        </div>
    );
}
