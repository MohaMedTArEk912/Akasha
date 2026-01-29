import { Sequelize } from 'sequelize-typescript';
import dotenv from 'dotenv';

dotenv.config();

/**
 * PostgreSQL Configuration for Platform & Business data
 * 
 * Uses Sequelize ORM with TypeScript decorators
 * Handles: users, organizations, permissions, subscriptions
 */

const DATABASE_URL = process.env.POSTGRES_URL || process.env.DATABASE_URL;

// Parse individual components or use connection string
const DB_HOST = process.env.POSTGRES_HOST || 'localhost';
const DB_PORT = parseInt(process.env.POSTGRES_PORT || '5432', 10);
const DB_NAME = process.env.POSTGRES_DB || 'grapes_platform';
const DB_USER = process.env.POSTGRES_USER || 'postgres';
const DB_PASS = process.env.POSTGRES_PASSWORD || '';

let sequelize: Sequelize;

if (DATABASE_URL) {
    // Use connection string if provided
    sequelize = new Sequelize(DATABASE_URL, {
        dialect: 'postgres',
        logging: process.env.NODE_ENV === 'development' ? console.log : false,
        pool: {
            max: 10,
            min: 0,
            acquire: 30000,
            idle: 10000
        },
        define: {
            timestamps: true,
            underscored: true, // Use snake_case for columns
        }
    });
} else {
    // Use individual connection parameters
    sequelize = new Sequelize({
        dialect: 'postgres',
        host: DB_HOST,
        port: DB_PORT,
        database: DB_NAME,
        username: DB_USER,
        password: DB_PASS,
        logging: process.env.NODE_ENV === 'development' ? console.log : false,
        pool: {
            max: 10,
            min: 0,
            acquire: 30000,
            idle: 10000
        },
        define: {
            timestamps: true,
            underscored: true,
        }
    });
}

/**
 * Test the database connection
 */
export async function connectPostgres(): Promise<void> {
    try {
        await sequelize.authenticate();
        console.log('✅ PostgreSQL connected successfully');

        // Sync models in development (don't use in production!)
        if (process.env.NODE_ENV === 'development') {
            await sequelize.sync({ alter: true });
            console.log('✅ PostgreSQL models synced');
        }
    } catch (error) {
        console.error('❌ PostgreSQL connection failed:', error);
        // Don't crash if Postgres isn't available - we can still use MongoDB
        console.warn('⚠️ Continuing without PostgreSQL - platform features will be limited');
    }
}

/**
 * Close the database connection gracefully
 */
export async function closePostgres(): Promise<void> {
    await sequelize.close();
    console.log('PostgreSQL connection closed');
}

export { sequelize };
export default sequelize;
