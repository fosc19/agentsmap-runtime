# Case study: observability for agent economic activity

## Problem

As agents, APIs and autonomous services start exchanging value through programmable payment surfaces, raw transactions alone are not enough. Builders need to understand resources, payment addresses, entities and activity patterns.

## Portfolio solution

This repository demonstrates the shape of an observability runtime for that problem:

- PostgreSQL schema for resources, attribution and activity;
- Fastify API for live data and operational inspection;
- React/Vite frontend for network visualization;
- synthetic demo worker for local activity generation;
- migration and seed tooling for reproducible local setup.

## What this shows

The project demonstrates end-to-end system thinking: data modeling, backend API design, local runtime ergonomics, live update surfaces, visualization and portfolio-safe sanitization.

## What is not published

The production implementation of discovery, indexing, correlation and classification is intentionally excluded. This keeps the repo useful as a technical portfolio while avoiding publication of product-specific know-how.
