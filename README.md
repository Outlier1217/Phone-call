# Phone-call

A React Native application built with Expo and Supabase.

## Current features

- Email and password signup and login
- Persistent authentication sessions
- Register up to 10 unique virtual phone numbers per account
- Assign labels to virtual numbers
- Registered numbers cannot be edited or deleted
- Add contacts using registered Phone-call numbers
- View and refresh saved contacts
- Database-backed validation and row-level security

## Tech stack

- Expo
- React Native
- TypeScript
- Supabase Authentication
- Supabase PostgreSQL

## Setup

1. Install dependencies with `pnpm install`.
2. Create a `.env` file in the project root.
3. Configure the following environment variables:

   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

4. Configure the required Supabase database tables, policies and functions.
5. Start the app with `pnpm start`.

## Current limitations

Virtual numbers are app-based identifiers, not real SIM or telecom numbers. Internet calling and messaging are not implemented yet.
