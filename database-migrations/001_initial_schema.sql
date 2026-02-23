
CREATE TABLE IF NOT EXISTS departments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Profiles table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    role TEXT NOT NULL DEFAULT 'dept_admin' CHECK (role IN ('super_admin', 'dept_admin')),
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Papers table
CREATE TABLE IF NOT EXISTS papers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    subject TEXT NOT NULL,
    subject_code TEXT,
    department_id UUID REFERENCES departments(id) ON DELETE CASCADE NOT NULL,
    semester INTEGER NOT NULL CHECK (semester >= 1 AND semester <= 8),
    exam_type TEXT NOT NULL CHECK (exam_type IN ('Weekly Test 1', 'Weekly Test 2', 'CIA 1', 'CIA 2', 'End Semester')),
    year TEXT NOT NULL,
    description TEXT,
    file_url TEXT,
    uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    uploaded_by_name TEXT,
    views INTEGER DEFAULT 0,
    downloads INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Favorites table
CREATE TABLE IF NOT EXISTS favorites (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    paper_id UUID REFERENCES papers(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (user_id, paper_id)
);

-- 5. Activity logs table
CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    type TEXT NOT NULL,
    message TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- Indexes for performance
-- =============================================
CREATE INDEX IF NOT EXISTS idx_papers_department ON papers(department_id);
CREATE INDEX IF NOT EXISTS idx_papers_semester ON papers(semester);
CREATE INDEX IF NOT EXISTS idx_papers_exam_type ON papers(exam_type);
CREATE INDEX IF NOT EXISTS idx_papers_year ON papers(year);
CREATE INDEX IF NOT EXISTS idx_papers_created_at ON papers(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_department ON profiles(department_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at DESC);

-- =============================================
-- Row Level Security (RLS) Policies
-- =============================================

-- Enable RLS on all tables
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Departments: anyone can read, only authenticated can modify
CREATE POLICY "Departments are viewable by everyone"
    ON departments FOR SELECT USING (true);

CREATE POLICY "Departments are modifiable by authenticated users"
    ON departments FOR ALL USING (auth.role() = 'authenticated');

-- Profiles: anyone can read, only the user can update their own
CREATE POLICY "Profiles are viewable by everyone"
    ON profiles FOR SELECT USING (true);

CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Profiles can be created by authenticated users"
    ON profiles FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Papers: anyone can read, authenticated can modify
CREATE POLICY "Papers are viewable by everyone"
    ON papers FOR SELECT USING (true);

CREATE POLICY "Papers are modifiable by authenticated users"
    ON papers FOR ALL USING (auth.role() = 'authenticated');

-- Favorites: users can manage their own favorites
CREATE POLICY "Users can view own favorites"
    ON favorites FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own favorites"
    ON favorites FOR ALL USING (auth.uid() = user_id);

-- Activity logs: authenticated users can read and create
CREATE POLICY "Activity logs are viewable by authenticated users"
    ON activity_logs FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Activity logs can be created by authenticated users"
    ON activity_logs FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- =============================================
-- Seed Data: Default Departments
-- =============================================
INSERT INTO departments (name, code) VALUES
    ('Computer Science & Engineering', 'CSE'),
    ('Electronics & Communication', 'ECE'),
    ('Mechanical Engineering', 'MECH'),
    ('Civil Engineering', 'CIVIL'),
    ('Electrical & Electronics', 'EEE'),
    ('Information Technology', 'IT')
ON CONFLICT (code) DO NOTHING;

-- =============================================
-- Storage Bucket
-- =============================================
-- NOTE: Create a storage bucket named "question_papers" in the 
-- Supabase Dashboard > Storage section. Set it to PUBLIC for reads.
-- This cannot be done via SQL — use the dashboard UI.
