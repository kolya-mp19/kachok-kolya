export default function DiaryPage() {
    return (
        <section aria-labelledby="diary-title">
            <h1 id="diary-title">Дневник</h1>
            <p className="context-description">План тренировок и записи о выполнении</p>
            <div className="empty-state">
                <h2>Дневник появится позже</h2>
                <p>Вход, планирование и записи тренировок ещё недоступны.</p>
            </div>
        </section>
    );
}
