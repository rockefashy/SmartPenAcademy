import { Testimonial } from '../../src/types';
import { getSupabase, applyRowCeiling } from './client.ts';

export function mapTestimonialRow(row: any): Testimonial {
  const displayTitle = (row.title && row.title !== 'Transformation Review')
    ? row.title
    : (row.before_after_tag || row.title || undefined);

  return {
    id: row.id,
    studentId: row.student_id || '',
    studentName: row.student_name || '',
    parentName: row.parent_name || '',
    grade: row.grade || undefined,
    schoolName: undefined,
    relationship: 'Parent',
    rating: row.rating !== undefined && row.rating !== null ? Number(row.rating) : 0,
    title: displayTitle,
    review: row.review || '',
    beforeAfterTag: row.before_after_tag || undefined,
    image: row.image || undefined,
    mediaConsent: Boolean(row.media_consent),
    status: (row.status || 'Published') as any,
    createdAt: row.created_at || ''
  };
}

export class TestimonialsDatabase {
  async getTestimonials(studentId?: string, status?: string): Promise<Testimonial[]> {
    const supabase = getSupabase();
    let query = supabase.from('testimonials').select('*');

    if (studentId) {
      query = query.eq('student_id', studentId);
    }
    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await applyRowCeiling(
      query.order('created_at', { ascending: false })
    );
    if (error) {
      throw new Error(`Failed to fetch testimonials: ${error.message}`);
    }
    return (data || []).map(mapTestimonialRow);
  }

  async saveTestimonial(testimonial: Partial<Testimonial>): Promise<Testimonial> {
    const supabase = getSupabase();
    const id = testimonial.id || `test-${Date.now()}`;
    const row = {
      id,
      student_id: testimonial.studentId || null,
      student_name: testimonial.studentName || null,
      parent_name: testimonial.parentName || null,
      grade: testimonial.grade || null,
      rating: testimonial.rating !== undefined && testimonial.rating !== null ? Number(testimonial.rating) : null,
      review: testimonial.review || null,
      title: testimonial.title || (testimonial as any).beforeAfterTag || null,
      handwriting_style: (testimonial as any).handwritingStyle || null,
      status: testimonial.status || null,
      is_featured: testimonial.status === 'Featured' ? true : (testimonial.status === 'Approved' ? false : null),
      image: testimonial.image || null,
      created_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('testimonials')
      .upsert(row, { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to save testimonial: ${error.message}`);
    }

    return mapTestimonialRow(data);
  }

  async updateTestimonial(id: string, updates: Partial<Testimonial>): Promise<Testimonial | null> {
    const supabase = getSupabase();
    const updateData: any = {};

    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.review !== undefined) {
      updateData.review = updates.review;
    }
    if (updates.rating !== undefined) updateData.rating = Number(updates.rating);
    if (updates.title !== undefined) updateData.title = updates.title;

    const { data, error } = await supabase
      .from('testimonials')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update testimonial ${id}: ${error.message}`);
    }

    return data ? mapTestimonialRow(data) : null;
  }

  async deleteTestimonial(id: string): Promise<void> {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('testimonials')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete testimonial: ${error.message}`);
    }
  }
}

export const testimonialsDb = new TestimonialsDatabase();
