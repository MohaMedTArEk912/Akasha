import {
    Table,
    Column,
    Model,
    DataType,
    PrimaryKey,
    Default,
    CreatedAt,
    UpdatedAt,
    HasMany,
    Unique,
    AllowNull,
    IsEmail,
    Index
} from 'sequelize-typescript';

/**
 * User roles enum
 */
export enum UserRole {
    ADMIN = 'admin',
    OWNER = 'owner',
    EDITOR = 'editor',
    VIEWER = 'viewer'
}

/**
 * User Model - Platform users
 * 
 * @description Stored in PostgreSQL for ACID compliance and
 * efficient permission queries across organizations/projects.
 */
@Table({
    tableName: 'users',
    timestamps: true,
    underscored: true
})
export class User extends Model {
    @PrimaryKey
    @Default(DataType.UUIDV4)
    @Column(DataType.UUID)
    declare id: string;

    @Unique
    @AllowNull(false)
    @IsEmail
    @Column(DataType.STRING(255))
    declare email: string;

    @AllowNull(true)
    @Column(DataType.STRING(255))
    declare passwordHash: string | null;

    @AllowNull(true)
    @Column(DataType.STRING(100))
    declare firstName: string | null;

    @AllowNull(true)
    @Column(DataType.STRING(100))
    declare lastName: string | null;

    @AllowNull(true)
    @Column(DataType.STRING(500))
    declare avatarUrl: string | null;

    @Default(UserRole.EDITOR)
    @Column(DataType.ENUM(...Object.values(UserRole)))
    declare role: UserRole;

    @Default(false)
    @Column(DataType.BOOLEAN)
    declare emailVerified: boolean;

    @AllowNull(true)
    @Column(DataType.STRING(100))
    declare googleId: string | null;

    @AllowNull(true)
    @Column(DataType.STRING(100))
    declare githubId: string | null;

    @AllowNull(true)
    @Column(DataType.DATE)
    declare lastLoginAt: Date | null;

    @CreatedAt
    declare createdAt: Date;

    @UpdatedAt
    declare updatedAt: Date;

    // Associations
    @HasMany(() => Organization, 'ownerId')
    declare ownedOrganizations: Organization[];

    @HasMany(() => Permission)
    declare permissions: Permission[];

    /**
     * Get full name
     */
    get fullName(): string {
        if (this.firstName && this.lastName) {
            return `${this.firstName} ${this.lastName}`;
        }
        return this.firstName || this.lastName || this.email.split('@')[0];
    }
}

/**
 * Organization Model - Teams/Companies
 */
@Table({
    tableName: 'organizations',
    timestamps: true,
    underscored: true
})
export class Organization extends Model {
    @PrimaryKey
    @Default(DataType.UUIDV4)
    @Column(DataType.UUID)
    declare id: string;

    @AllowNull(false)
    @Column(DataType.STRING(255))
    declare name: string;

    @AllowNull(true)
    @Column(DataType.STRING(100))
    declare slug: string | null;

    @AllowNull(true)
    @Column(DataType.STRING(500))
    declare logoUrl: string | null;

    @AllowNull(false)
    @Column(DataType.UUID)
    declare ownerId: string;

    @Default(true)
    @Column(DataType.BOOLEAN)
    declare isActive: boolean;

    @CreatedAt
    declare createdAt: Date;

    @UpdatedAt
    declare updatedAt: Date;

    // Associations defined via foreign keys
    @HasMany(() => Permission)
    declare permissions: Permission[];

    @HasMany(() => Subscription)
    declare subscriptions: Subscription[];
}

/**
 * Access levels for permissions
 */
export enum AccessLevel {
    OWNER = 'owner',
    ADMIN = 'admin',
    EDITOR = 'editor',
    COMMENTER = 'commenter',
    VIEWER = 'viewer'
}

/**
 * Permission Model - User access to projects
 */
@Table({
    tableName: 'permissions',
    timestamps: true,
    underscored: true
})
export class Permission extends Model {
    @PrimaryKey
    @Default(DataType.UUIDV4)
    @Column(DataType.UUID)
    declare id: string;

    @AllowNull(false)
    @Index
    @Column(DataType.UUID)
    declare userId: string;

    @AllowNull(false)
    @Index
    @Column(DataType.STRING(100)) // MongoDB ObjectId as string
    declare projectId: string;

    @AllowNull(true)
    @Column(DataType.UUID)
    declare organizationId: string | null;

    @AllowNull(false)
    @Column(DataType.ENUM(...Object.values(AccessLevel)))
    declare accessLevel: AccessLevel;

    @AllowNull(true)
    @Column(DataType.DATE)
    declare expiresAt: Date | null;

    @CreatedAt
    declare createdAt: Date;

    @UpdatedAt
    declare updatedAt: Date;

    /**
     * Check if permission allows editing
     */
    canEdit(): boolean {
        return [AccessLevel.OWNER, AccessLevel.ADMIN, AccessLevel.EDITOR].includes(this.accessLevel);
    }

    /**
     * Check if permission allows admin actions
     */
    canAdmin(): boolean {
        return [AccessLevel.OWNER, AccessLevel.ADMIN].includes(this.accessLevel);
    }
}

/**
 * Subscription plans
 */
export enum SubscriptionPlan {
    FREE = 'free',
    STARTER = 'starter',
    PRO = 'pro',
    BUSINESS = 'business',
    ENTERPRISE = 'enterprise'
}

/**
 * Subscription status
 */
export enum SubscriptionStatus {
    ACTIVE = 'active',
    TRIAL = 'trial',
    PAST_DUE = 'past_due',
    CANCELED = 'canceled',
    EXPIRED = 'expired'
}

/**
 * Subscription Model - Billing/Plans
 */
@Table({
    tableName: 'subscriptions',
    timestamps: true,
    underscored: true
})
export class Subscription extends Model {
    @PrimaryKey
    @Default(DataType.UUIDV4)
    @Column(DataType.UUID)
    declare id: string;

    @AllowNull(false)
    @Index
    @Column(DataType.UUID)
    declare organizationId: string;

    @AllowNull(false)
    @Default(SubscriptionPlan.FREE)
    @Column(DataType.ENUM(...Object.values(SubscriptionPlan)))
    declare plan: SubscriptionPlan;

    @AllowNull(false)
    @Default(SubscriptionStatus.ACTIVE)
    @Column(DataType.ENUM(...Object.values(SubscriptionStatus)))
    declare status: SubscriptionStatus;

    @AllowNull(true)
    @Column(DataType.STRING(100))
    declare stripeCustomerId: string | null;

    @AllowNull(true)
    @Column(DataType.STRING(100))
    declare stripeSubscriptionId: string | null;

    @AllowNull(true)
    @Column(DataType.DATE)
    declare trialEndsAt: Date | null;

    @AllowNull(true)
    @Column(DataType.DATE)
    declare currentPeriodStart: Date | null;

    @AllowNull(true)
    @Column(DataType.DATE)
    declare currentPeriodEnd: Date | null;

    @AllowNull(true)
    @Column(DataType.DATE)
    declare canceledAt: Date | null;

    @AllowNull(true)
    @Column(DataType.DATE)
    declare expiresAt: Date | null;

    @CreatedAt
    declare createdAt: Date;

    @UpdatedAt
    declare updatedAt: Date;

    /**
     * Check if subscription is active
     */
    isActive(): boolean {
        if (this.status !== SubscriptionStatus.ACTIVE && this.status !== SubscriptionStatus.TRIAL) {
            return false;
        }
        if (this.expiresAt && new Date() > this.expiresAt) {
            return false;
        }
        return true;
    }

    /**
     * Get remaining trial days
     */
    trialDaysRemaining(): number | null {
        if (this.status !== SubscriptionStatus.TRIAL || !this.trialEndsAt) {
            return null;
        }
        const now = new Date();
        const diff = this.trialEndsAt.getTime() - now.getTime();
        return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    }
}
