// queries/part3_threshold_experiments.js
// Емпіричні порівняння порогів для теоретичних питань у Part 3 (README).
// Запуск: mongosh "$env:MONGO_URI" --file queries/part3_threshold_experiments.js

const DB_NAME = "spotify";
const spotifyDb = db.getSiblingDB(DB_NAME);

print("\n=== Part 3 — теоретичні питання: пороги (емпірика для README) ===");
print("Зробіть скріншоти блоків нижче для підстави в README:");
print("  • task_3_theory_artists_min50.png  — блок «≥50 треків»");
print("  • task_3_theory_artists_min1.png   — блок «≥1 трек»");
print("  • task_3_theory_genres_thresholds_100.png — блок жанрів з порогом ≥100");
print("  • task_3_theory_genres_thresholds_50.png  — блок жанрів з порогом ≥50");

function printTopArtists(minTracks, label) {
	print("\n" + "=".repeat(70));
	print(label);
	print(`Критерії: мінімум ${minTracks} трек(ів) на виконавця`);
	print("");

	const rows = spotifyDb.tracks_by_genres.aggregate(
		[
			{ $project: { _id: 0, artists: 1, popularity: 1 } },
			{ $unwind: "$artists" },
			{
				$group: {
					_id: "$artists",
					trackCount: { $sum: 1 },
					avgPopularity: { $avg: "$popularity" },
				},
			},
			{ $match: { trackCount: { $gte: minTracks } } },
			{ $sort: { avgPopularity: -1 } },
			{ $limit: 10 },
			{
				$project: {
					_id: 0,
					artist: "$_id",
					avgPopularity: { $round: ["$avgPopularity", 1] },
					trackCount: 1,
				},
			},
		],
		{ allowDiskUse: true }
	).toArray();

	print(`Знайдено виконавців: ${rows.length}`);
	rows.forEach((r, i) => {
		print(`${i + 1}. ${r.artist}`);
		print(`   Середня популярність: ${r.avgPopularity}, Треків: ${r.trackCount}`);
	});
}

function printDanceableGenres(minTracks, label) {
	print("\n" + "=".repeat(70));
	print(label);
	print(`Критерії: мінімум ${minTracks} треків у жанрі`);
	print("");
	print("genre | avg_danceability | avg_energy | avg_valence | track_count");
	print("---------------------------------------------------------------");

	const rows = spotifyDb.tracks_by_genres.aggregate(
		[
			{
				$project: {
					_id: 0,
					track_genres: 1,
					"audio_features.danceability": 1,
					"audio_features.energy": 1,
					"audio_features.valence": 1,
				},
			},
			{ $unwind: "$track_genres" },
			{
				$group: {
					_id: "$track_genres",
					trackCount: { $sum: 1 },
					avgDanceability: { $avg: "$audio_features.danceability" },
					avgEnergy: { $avg: "$audio_features.energy" },
					avgValence: { $avg: "$audio_features.valence" },
				},
			},
			{ $match: { trackCount: { $gte: minTracks } } },
			{
				$sort: {
					avgDanceability: -1,
					avgEnergy: -1,
					avgValence: -1,
				},
			},
			{
				$project: {
					_id: 0,
					genre: "$_id",
					avg_danceability: { $round: ["$avgDanceability", 3] },
					avg_energy: { $round: ["$avgEnergy", 3] },
					avg_valence: { $round: ["$avgValence", 3] },
					track_count: "$trackCount",
				},
			},
		],
		{ allowDiskUse: true }
	).toArray();

	print(`Рядків у таблиці: ${rows.length}`);
	rows.forEach((g) => {
		print(
			`${g.genre} | ${g.avg_danceability} | ${g.avg_energy} | ${g.avg_valence} | ${g.track_count}`
		);
	});
}



printTopArtists(50, "ТОП-10 ВИКОНАВЦІВ (поріг  >50)");
printTopArtists(1, "ТОП-10 ВИКОНАВЦІВ (поріг 1 )");

printDanceableGenres(
	100,
	"ЗАВДАННЯ 3: «танцювальні» жанри — той самий пайплайн, поріг ≥100"
);
printDanceableGenres(
	50,
	"ЗАВДАННЯ 3: той самий пайплайн, поріг знижено до ≥50 (порівняння)"
);

const c100 = spotifyDb.tracks_by_genres
	.aggregate([
		{ $project: { _id: 0, track_genres: 1 } },
		{ $unwind: "$track_genres" },
		{ $group: { _id: "$track_genres", trackCount: { $sum: 1 } } },
		{ $match: { trackCount: { $gte: 100 } } },
		{ $count: "n" },
	])
	.toArray();
const c50 = spotifyDb.tracks_by_genres
	.aggregate([
		{ $project: { _id: 0, track_genres: 1 } },
		{ $unwind: "$track_genres" },
		{ $group: { _id: "$track_genres", trackCount: { $sum: 1 } } },
		{ $match: { trackCount: { $gte: 50 } } },
		{ $count: "n" },
	])
	.toArray();

print("\n" + "=".repeat(70));
print(
	`Кількість жанрів після фільтра: ≥100 треків → ${c100[0]?.n ?? 0}; ≥50 треків → ${c50[0]?.n ?? 0}`
);
print("=== Готово ===\n");
