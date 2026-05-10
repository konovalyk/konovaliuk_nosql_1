// scripts/03_consolidate_genres.js
// Запуск:
// mongosh "$env:MONGO_URI" --file scripts/03_consolidate_genres.js

const DB_NAME = "spotify";
const sourceDb = db.getSiblingDB(DB_NAME);

const pipeline = [
	{
		$group: {
			_id: "$track_id",
			doc: { $first: "$$ROOT" },
			genres: { $addToSet: "$track_genre" },
		},
	},
	{
		$set: {
			"doc.track_genres": "$genres",
		},
	},
	{
		$replaceRoot: { newRoot: "$doc" },
	},
	{
		$unset: "track_genre",
	},
	{
		$out: "tracks_by_genres",
	},
];

sourceDb.tracks.aggregate(pipeline, { allowDiskUse: true }).toArray();

const collection = sourceDb.getCollection("tracks_by_genres");
print(`Завантажено документів у tracks_by_genres: ${collection.countDocuments({})}`);
print("Приклад документа:");
printjson(collection.findOne());
