'use client';
import React from 'react';

export default function InboxLoading() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        flex: 1,
        height: '100%',
        minHeight: 'calc(100vh - 80px)',
        width: '100%',
        background: 'var(--bg-main, #040814)',
        overflow: 'hidden',
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes pulse-pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 0.2; }
        }
      `}} />

      {/* 1. Sidebar Skeleton */}
      <div
        style={{
          width: '320px',
          borderRight: '1px solid var(--border, rgba(255,255,255,0.08))',
          display: 'flex',
          flexDirection: 'column',
          background: 'rgba(10, 20, 40, 0.1)',
          padding: '16px',
          gap: '16px',
        }}
      >
        {/* Search Bar Skeleton */}
        <div
          style={{
            height: '42px',
            borderRadius: '12px',
            background: 'rgba(255, 255, 255, 0.05)',
            animation: 'pulse-pulse 1.5s infinite ease-in-out',
          }}
        />

        {/* Tab Buttons Skeleton */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <div
            style={{
              height: '32px',
              flex: 1,
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.05)',
              animation: 'pulse-pulse 1.5s infinite ease-in-out',
            }}
          />
          <div
            style={{
              height: '32px',
              flex: 1,
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.05)',
              animation: 'pulse-pulse 1.5s infinite ease-in-out',
            }}
          />
        </div>

        {/* Chat List Skeletons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px',
                borderRadius: '16px',
                background: 'rgba(255, 255, 255, 0.02)',
              }}
            >
              {/* Avatar */}
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.05)',
                  animation: 'pulse-pulse 1.5s infinite ease-in-out',
                }}
              />
              {/* Name + Text */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div
                  style={{
                    width: '60%',
                    height: '14px',
                    borderRadius: '4px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    animation: 'pulse-pulse 1.5s infinite ease-in-out',
                  }}
                />
                <div
                  style={{
                    width: '85%',
                    height: '12px',
                    borderRadius: '4px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    animation: 'pulse-pulse 1.5s infinite ease-in-out',
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Main Chat Area Skeleton */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          background: 'rgba(5, 10, 25, 0.05)',
        }}
      >
        {/* Chat Header Skeleton */}
        <div
          style={{
            height: '73px',
            borderBottom: '1px solid var(--border, rgba(255,255,255,0.08))',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.05)',
              animation: 'pulse-pulse 1.5s infinite ease-in-out',
            }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div
              style={{
                width: '120px',
                height: '16px',
                borderRadius: '4px',
                background: 'rgba(255, 255, 255, 0.05)',
                animation: 'pulse-pulse 1.5s infinite ease-in-out',
              }}
            />
            <div
              style={{
                width: '80px',
                height: '12px',
                borderRadius: '4px',
                background: 'rgba(255, 255, 255, 0.03)',
                animation: 'pulse-pulse 1.5s infinite ease-in-out',
              }}
            />
          </div>
        </div>

        {/* Chat Messages Placeholder */}
        <div
          style={{
            flex: 1,
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            gap: '24px',
          }}
        >
          {/* Left Bubble */}
          <div style={{ display: 'flex', gap: '12px', width: '60%' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.05)',
                animation: 'pulse-pulse 1.5s infinite ease-in-out',
              }}
            />
            <div
              style={{
                flex: 1,
                height: '56px',
                borderRadius: '16px 16px 16px 4px',
                background: 'rgba(255, 255, 255, 0.03)',
                animation: 'pulse-pulse 1.5s infinite ease-in-out',
              }}
            />
          </div>

          {/* Right Bubble */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
            <div
              style={{
                width: '45%',
                height: '42px',
                borderRadius: '16px 16px 4px 16px',
                background: 'rgba(255, 255, 255, 0.05)',
                animation: 'pulse-pulse 1.5s infinite ease-in-out',
              }}
            />
          </div>

          {/* Left Bubble 2 */}
          <div style={{ display: 'flex', gap: '12px', width: '50%' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.05)',
                animation: 'pulse-pulse 1.5s infinite ease-in-out',
              }}
            />
            <div
              style={{
                flex: 1,
                height: '80px',
                borderRadius: '16px 16px 16px 4px',
                background: 'rgba(255, 255, 255, 0.03)',
                animation: 'pulse-pulse 1.5s infinite ease-in-out',
              }}
            />
          </div>
        </div>

        {/* Input Bar Skeleton */}
        <div
          style={{
            height: '84px',
            borderTop: '1px solid var(--border, rgba(255,255,255,0.08))',
            padding: '16px 24px',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              flex: 1,
              height: '48px',
              borderRadius: '24px',
              background: 'rgba(255, 255, 255, 0.04)',
              animation: 'pulse-pulse 1.5s infinite ease-in-out',
            }}
          />
        </div>
      </div>
    </div>
  );
}
