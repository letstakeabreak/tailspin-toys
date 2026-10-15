import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase } from '../../db/test-helpers';
import { categories, publishers, games } from '../../db/schema';
import type { Database } from './db';
import {
    getAllGames,
    getAllGameIds,
    getGameById,
    filterGames,
    getAllCategories,
    getAllPublishers,
} from './games';

async function seedGames(db: Database, count: number): Promise<void> {
    const [category] = await db
        .insert(categories)
        .values({ name: 'Strategy', description: 'cat' })
        .returning({ id: categories.id });
    const [publisher] = await db
        .insert(publishers)
        .values({ name: 'Pub One', description: 'pub' })
        .returning({ id: publishers.id });

    // Insert titles in reverse-alphabetical order to prove ordering is applied.
    for (let i = count; i >= 1; i--) {
        await db.insert(games).values({
            title: `Game ${String(i).padStart(2, '0')}`,
            description: `Description ${i}`,
            starRating: 4.2,
            categoryId: category.id,
            publisherId: publisher.id,
        });
    }
}

describe('games data-access helpers', () => {
    let db: Database;

    beforeEach(async () => {
        db = await createTestDatabase();
    });

    it('returns all games ordered by title', async () => {
        await seedGames(db, 3);
        const all = await getAllGames(db);
        expect(all.map((g) => g.title)).toEqual(['Game 01', 'Game 02', 'Game 03']);
        expect(all[0].category).toEqual({ id: expect.any(Number), name: 'Strategy' });
        expect(all[0].publisher).toEqual({ id: expect.any(Number), name: 'Pub One' });
    });

    it('returns all game ids ordered by title', async () => {
        await seedGames(db, 3);
        const ids = await getAllGameIds(db);
        const all = await getAllGames(db);
        expect(ids).toEqual(all.map((g) => g.id));
    });

    it('fetches a single game by id', async () => {
        await seedGames(db, 2);
        const ids = await getAllGameIds(db);
        const game = await getGameById(db, ids[0]);
        expect(game?.title).toBe('Game 01');
    });

    it('returns null for a non-existent game', async () => {
        await seedGames(db, 2);
        expect(await getGameById(db, 99999)).toBeNull();
    });
});

describe('game filtering helpers', () => {
    let db: Database;
    let ids: { c1: number; c2: number; c3: number; p1: number; p2: number };

    beforeEach(async () => {
        db = await createTestDatabase();
        const cats = await db
            .insert(categories)
            .values([
                { name: 'Strategy', description: 'c' },
                { name: 'Card', description: 'c' },
                { name: 'Empty', description: 'c' },
            ])
            .returning({ id: categories.id });
        const pubs = await db
            .insert(publishers)
            .values([
                { name: 'Pub Two', description: 'p' },
                { name: 'Pub One', description: 'p' },
            ])
            .returning({ id: publishers.id });
        ids = { c1: cats[0].id, c2: cats[1].id, c3: cats[2].id, p1: pubs[0].id, p2: pubs[1].id };
        await db.insert(games).values([
            { title: 'A', description: 'd', categoryId: ids.c1, publisherId: ids.p1 },
            { title: 'B', description: 'd', categoryId: ids.c1, publisherId: ids.p2 },
            { title: 'C', description: 'd', categoryId: ids.c2, publisherId: ids.p1 },
        ]);
    });

    /** Extracts titles from a list of games for concise assertions. */
    const titles = (list: { title: string }[]): string[] => list.map((g) => g.title);

    it('returns all games when no filters are given', async () => {
        expect(titles(await filterGames(db))).toEqual(['A', 'B', 'C']);
        expect(titles(await filterGames(db, { categoryIds: [] }))).toEqual(['A', 'B', 'C']);
    });

    it('filters by a single category', async () => {
        expect(titles(await filterGames(db, { categoryIds: [ids.c1] }))).toEqual(['A', 'B']);
    });

    it('filters by multiple categories (OR)', async () => {
        expect(titles(await filterGames(db, { categoryIds: [ids.c1, ids.c2] }))).toEqual(['A', 'B', 'C']);
    });

    it('filters by publisher', async () => {
        expect(titles(await filterGames(db, { publisherId: ids.p1 }))).toEqual(['A', 'C']);
    });

    it('combines category and publisher filters (AND)', async () => {
        expect(
            titles(await filterGames(db, { categoryIds: [ids.c1], publisherId: ids.p1 })),
        ).toEqual(['A']);
    });

    it('returns an empty list when nothing matches', async () => {
        expect(await filterGames(db, { categoryIds: [ids.c3] })).toEqual([]);
    });

    it('lists categories and publishers ordered by name', async () => {
        expect((await getAllCategories(db)).map((c) => c.name)).toEqual(['Card', 'Empty', 'Strategy']);
        expect((await getAllPublishers(db)).map((p) => p.name)).toEqual(['Pub One', 'Pub Two']);
    });
});
