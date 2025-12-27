-- Drop the current permissive policy
DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;

-- Create a proper policy that requires authentication
CREATE POLICY "Authenticated users can upload avatars" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'avatars' 
  AND auth.uid() IS NOT NULL
);