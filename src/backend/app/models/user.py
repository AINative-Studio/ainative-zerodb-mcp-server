"""
User Models Module
Following Semantic Seed V2.0 Standards

This module defines user, organization, and project models with
role-based access control as specified in Sprint 2 requirements.
"""

from datetime import datetime
from typing import List, Optional, Dict, Any
import enum
from sqlalchemy import (
    Column,
    String,
    Text,
    Boolean,
    ForeignKey,
    DateTime,
    Table,
    JSON,
    Enum,
    Integer,
    Index,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from uuid import uuid4
from app.db.base_class import Base
from app.models.base_models import UUIDMixin
from sqlalchemy import Column, DateTime
from sqlalchemy.sql import func

class UserTimestampMixin:
    """
    Custom timestamp mixin for User model that matches database schema
    (without created_by/updated_by columns)
    """
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


# Import association tables from centralized module to avoid duplicates
from app.models.association_tables import user_organizations, user_projects


# Alias for backward compatibility
user_organization = user_organizations

user_roles = Table(
    "user_roles",
    Base.metadata,
    Column("user_id", UUID(), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("role_id", UUID(), ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True),
    Column("created_at", DateTime, default=datetime.utcnow),
    Column("updated_at", DateTime, default=datetime.utcnow, onupdate=datetime.utcnow),
)


class UserRole(str, enum.Enum):
    """User roles for role-based access control (Sprint 2)"""
    ADMIN = "ADMIN"  # Match database values exactly
    DEVELOPER = "DEVELOPER"
    USER = "USER"
    GUEST = "GUEST"
    MEMBER = "MEMBER"  # Added for compatibility with existing schemas


class UserStatus(str, enum.Enum):
    """User account status"""
    ACTIVE = "ACTIVE"  # Match database values exactly
    INACTIVE = "INACTIVE"
    SUSPENDED = "SUSPENDED"
    PENDING = "PENDING"


class Role(Base, UUIDMixin, UserTimestampMixin):
    """
    Role Model - Defines roles with permissions
    Following SCSS V2.0 standards for direct SQL operations
    """
    __tablename__ = "roles"
    
    id = Column(UUID(), primary_key=True, default=uuid4)
    name = Column(String(50), nullable=False, unique=True, index=True)
    description = Column(Text, nullable=True)
    permissions = Column(JSON, nullable=True)
    is_system_role = Column(Boolean, default=False)
    
    # Direct SQL relationships without ORM abstractions (SCSS V2.0)
    users = relationship(
        "User",
        secondary=user_roles,
        back_populates="roles",
        cascade="all, delete",
    )


class User(Base, UserTimestampMixin, UUIDMixin):
    """
    User model with role-based access control
    
    Implements RBAC as specified in Sprint 2 requirements
    """
    __tablename__ = "users"
    __table_args__ = {'extend_existing': True}
    
    id = Column(UUID(), primary_key=True, default=uuid4)
    # Basic user info
    email = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, nullable=True)
    full_name = Column(String, nullable=True)
    is_superuser = Column(Boolean, default=False, nullable=False)
    email_verified = Column(Boolean, default=False, nullable=False)
    permissions = Column(JSON, default=dict, nullable=True)
    
    # Authentication
    hashed_password = Column(String, nullable=False)
    
    # OAuth integration
    github_id = Column(String, nullable=True)

    # Payment integration (Stripe) - TODO: Add via migration
    # stripe_customer_id = Column(String(255), nullable=True, index=True)

    # Account status
    is_active = Column(Boolean, default=True, nullable=False)
    status = Column(String(50), default="ACTIVE", nullable=True)  # Match database schema
    last_login_at = Column(DateTime(timezone=True), nullable=True)
    
    # Role-based access control (Sprint 2)
    role = Column(String(50), default="USER", nullable=True)  # Match database schema
    
    # Password reset fields
    password_reset_token = Column(String, nullable=True)
    password_reset_expires = Column(DateTime(timezone=True), nullable=True)
    
    # Direct SQL relationships without ORM abstractions (SCSS V2.0)
    roles = relationship(
        "Role",
        secondary=user_roles,
        back_populates="users",
        cascade="all, delete",
    )
    
    # Relationships
    organizations = relationship(
        "Organization",
        secondary=user_organizations,
        back_populates="users",
    )
    
    # Direct project access
    projects = relationship(
        "Project",
        secondary=user_projects,
        back_populates="users",
    )
    
    # Owned projects (direct ownership)
    owned_projects = relationship("Project", foreign_keys="[Project.user_id]", back_populates="owner")
    
    # Related models
    api_keys = relationship("APIKey", back_populates="user", cascade="all, delete-orphan")
    # documents = relationship("Document", back_populates="user", foreign_keys="[Document.user_id]")  # Commented out - Document model simplified, no user_id field
    ai_usage_logs = relationship("AIUsageLog", back_populates="user")
    credit_transactions = relationship("CreditTransaction", back_populates="user", cascade="all, delete-orphan")
    ai_usage_aggregates = relationship("AIUsageAggregate", back_populates="user")
    chat_sessions = relationship("ChatSession", back_populates="user")
    chat_messages = relationship("ChatMessage", back_populates="user")
    chat_participations = relationship("ChatParticipant", back_populates="user")
    quantum_jobs = relationship("QuantumJob", back_populates="user")
    audit_logs = relationship("AuditLog", back_populates="user")
    webhooks = relationship("Webhook", back_populates="user", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<User {self.email} ({self.role})>"


# Organization class moved to app.models.organization to avoid duplicate definitions
# Import from there instead of defining here to resolve SQLAlchemy registry conflicts


class Project(Base, UserTimestampMixin, UUIDMixin):
    """
    Unified Project model combining projects and zerodb_projects
    
    This model consolidates project management and database features
    into a single table, eliminating redundancy and API conflicts.
    """
    __tablename__ = "projects"
    __table_args__ = (
        Index('idx_projects_user_id', 'user_id'),
        Index('idx_projects_status', 'status'),
        Index('idx_projects_tier', 'tier'),
        Index('idx_projects_database_enabled', 'database_enabled'),
        Index('idx_projects_deleted_at', 'deleted_at'),
        {'extend_existing': True}
    )
    
    # Core identification
    id = Column(UUID(), primary_key=True, default=uuid4)
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    user_id = Column(UUID(), ForeignKey("users.id"), nullable=True)
    organization_id = Column(UUID(), ForeignKey("organizations.id"), nullable=True)
    
    # Project status and tier
    status = Column(String(50), default='ACTIVE', nullable=False)
    tier = Column(String(50), default='free', nullable=False)
    
    # Database features (consolidated from zerodb_projects)
    database_enabled = Column(Boolean, default=True, nullable=False)
    vector_dimensions = Column(Integer, default=1536, nullable=False)
    quantum_enabled = Column(Boolean, default=False, nullable=False)
    mcp_enabled = Column(Boolean, default=False, nullable=False)
    database_config = Column(JSON, default=dict, nullable=False)
    
    # Railway service URLs for database features
    railway_project_id = Column(String(255), nullable=True)
    qdrant_url = Column(String(255), nullable=True)
    minio_url = Column(String(255), nullable=True)
    redpanda_url = Column(String(255), nullable=True)
    
    # Usage tracking metrics
    vectors_count = Column(Integer, default=0, nullable=False)
    tables_count = Column(Integer, default=0, nullable=False)
    events_count = Column(Integer, default=0, nullable=False)
    memory_usage_mb = Column(Integer, default=0, nullable=False)
    storage_usage_mb = Column(Integer, default=0, nullable=False)
    
    # Soft delete support
    deleted_at = Column(DateTime, nullable=True)
    
    # Relationships
    owner = relationship("User", foreign_keys=[user_id], back_populates="owned_projects")
    organization = relationship("Organization", back_populates="projects")
    users = relationship(
        "User",
        secondary=user_projects,
        back_populates="projects",
    )
    
    # Related models
    ai_usage_logs = relationship("AIUsageLog", back_populates="project")
    ai_usage_aggregates = relationship("AIUsageAggregate", back_populates="project")
    
    @property
    def is_active(self) -> bool:
        """Check if project is active (not deleted)"""
        return self.status == 'ACTIVE' and self.deleted_at is None
    
    @property
    def tier_limits(self) -> Dict[str, int]:
        """Get usage limits for project tier"""
        limits = {
            "free": {
                "max_projects": 3,
                "max_vectors": 10000,
                "max_tables": 5,
                "max_events_per_month": 100000,
                "max_storage_gb": 1
            },
            "pro": {
                "max_projects": 10,
                "max_vectors": 100000,
                "max_tables": 50,
                "max_events_per_month": 1000000,
                "max_storage_gb": 10
            },
            "scale": {
                "max_projects": 50,
                "max_vectors": 1000000,
                "max_tables": 500,
                "max_events_per_month": 10000000,
                "max_storage_gb": 100
            },
            "enterprise": {
                "max_projects": -1,  # Unlimited
                "max_vectors": -1,
                "max_tables": -1,
                "max_events_per_month": -1,
                "max_storage_gb": -1
            }
        }
        return limits.get(self.tier, limits["free"])
    
    def soft_delete(self) -> None:
        """Soft delete the project"""
        self.status = 'DELETED'
        self.deleted_at = datetime.utcnow()
    
    def restore(self) -> None:
        """Restore a soft-deleted project"""
        self.status = 'ACTIVE'
        self.deleted_at = None
    
    def __repr__(self):
        return f"<Project {self.name} (tier={self.tier}, status={self.status})>"


class APIKey(Base, UserTimestampMixin, UUIDMixin):
    """
    API Key model for authentication

    Users can have multiple API keys for different applications
    """
    __tablename__ = "api_keys"
    __table_args__ = (
        Index('idx_api_keys_hash', 'key_hash'),
        Index('idx_api_keys_user_active', 'user_id', 'is_active'),
        Index('idx_api_keys_expires_at', 'expires_at', postgresql_where='expires_at IS NOT NULL'),
        {'extend_existing': True}
    )

    id = Column(UUID(), primary_key=True, default=uuid4)
    # API key details
    user_id = Column(UUID(), ForeignKey("users.id"), nullable=False)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    key_prefix = Column(String(10), nullable=False, index=True)  # First 8 chars for identification
    key_hash = Column(String(255), nullable=False, unique=True)  # Hashed key for security

    # Permissions and rate limiting
    permissions = Column(JSONB, default=list, nullable=False)  # ["read", "write", "admin"]
    rate_limit = Column(Integer, default=1000, nullable=False)  # Requests per hour
    ip_whitelist = Column(JSONB, nullable=True)  # Optional IP restrictions

    # Key status
    is_active = Column(Boolean, default=True, nullable=False)
    expires_at = Column(DateTime, nullable=True)
    last_used_at = Column(DateTime, nullable=True)
    revoked_at = Column(DateTime, nullable=True)
    revoked_reason = Column(Text, nullable=True)

    # Usage tracking
    usage_count = Column(Integer, default=0, nullable=False)
    request_count_today = Column(Integer, default=0, nullable=False)
    last_request_at = Column(DateTime, nullable=True)

    # Custom metadata for tracking
    custom_metadata = Column(JSONB, default=dict, nullable=True)

    # Relationships
    user = relationship("User", back_populates="api_keys")
    activity_logs = relationship("APIKeyActivityLog", back_populates="api_key", cascade="all, delete-orphan")

    @property
    def is_expired(self) -> bool:
        """Check if the API key has expired"""
        if not self.expires_at:
            return False
        return datetime.utcnow() > self.expires_at

    @property
    def is_valid(self) -> bool:
        """Check if the API key is valid for use"""
        return self.is_active and not self.is_expired and not self.revoked_at

    def has_permission(self, permission: str) -> bool:
        """Check if API key has a specific permission"""
        if not self.permissions:
            return False
        return permission in self.permissions or "admin" in self.permissions

    def revoke(self, reason: str = None):
        """Revoke the API key"""
        self.is_active = False
        self.revoked_at = datetime.utcnow()
        self.revoked_reason = reason

    def __repr__(self):
        return f"<APIKey {self.name} ({self.key_prefix}...)>"


# Document class moved to app.models.document to avoid conflicts


# AIUsageLog class moved to app.models.ai_usage to avoid duplicate definitions
# Import from there instead of defining here to resolve SQLAlchemy registry conflicts


# ChatSession class moved to app.models.chat to avoid duplicate definitions
# Import from there instead of defining here to resolve SQLAlchemy registry conflicts


# Subscription class moved to app.models.subscription to avoid duplicate definitions
# Import from there instead of defining here to resolve SQLAlchemy registry conflicts
