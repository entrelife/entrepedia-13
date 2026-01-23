-- Add DELETE policy for reports table so admins can delete reports when deleting posts
CREATE POLICY "Admins can delete reports" 
ON public.reports 
FOR DELETE 
USING (has_any_admin_role(auth.uid()));