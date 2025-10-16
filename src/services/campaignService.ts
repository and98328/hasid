import { supabase } from '../lib/supabase';

export interface Campaign {
  id: string;
  restaurant_id: string;
  name: string;
  description?: string;
  type: 'one_time' | 'scheduled' | 'recurring' | 'ab_test';
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'cancelled' | 'paused';
  primary_channel: 'push' | 'whatsapp' | 'email' | 'sms';
  fallback_channel?: 'push' | 'whatsapp' | 'email' | 'sms';
  audience_type: 'all' | 'tagged' | 'custom_filter' | 'location_radius' | 'last_order_date' | 'wallet_status';
  audience_filter: Record<string, any>;
  estimated_audience_size: number;
  scheduled_at?: string;
  recurring_config?: Record<string, any>;
  ab_test_config?: Record<string, any>;
  created_by?: string;
  created_at: string;
  updated_at: string;
  sent_at?: string;
}

export interface CampaignMessage {
  id: string;
  campaign_id: string;
  channel: 'push' | 'whatsapp' | 'email' | 'sms';
  subject?: string;
  message_template: string;
  variables: Record<string, any>;
  ab_variant?: 'A' | 'B';
  created_at: string;
}

export interface PromoCode {
  id: string;
  campaign_id?: string;
  restaurant_id: string;
  code: string;
  discount_type: 'percentage' | 'fixed_amount';
  discount_value: number;
  min_spend: number;
  max_uses?: number;
  max_uses_per_customer: number;
  total_uses: number;
  order_type: 'all' | 'eats_only' | 'delivery_only';
  valid_from: string;
  valid_until: string;
  is_active: boolean;
  created_at: string;
}

export interface CampaignMetrics {
  id: string;
  campaign_id: string;
  total_targeted: number;
  total_sent: number;
  total_delivered: number;
  total_failed: number;
  total_bounced: number;
  total_opened: number;
  total_clicked: number;
  total_conversions: number;
  total_redemptions: number;
  total_revenue_generated: number;
  cost_per_send: number;
  roi: number;
  updated_at: string;
}

export interface CustomerTag {
  id: string;
  restaurant_id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface CustomerConsent {
  id: string;
  customer_id: string;
  restaurant_id: string;
  push_notifications: boolean;
  whatsapp: boolean;
  email: boolean;
  sms: boolean;
  consent_date: string;
  updated_at: string;
}

export class CampaignService {
  static async getCampaigns(restaurantId: string): Promise<Campaign[]> {
    const { data, error } = await supabase
      .from('campaigns')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
  }

  static async getCampaign(campaignId: string): Promise<Campaign | null> {
    const { data, error } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data;
  }

  static async createCampaign(campaign: Partial<Campaign>): Promise<Campaign> {
    const { data: userData } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('campaigns')
      .insert({
        ...campaign,
        created_by: userData?.user?.id,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    await this.logAuditAction(data.id, 'created', userData?.user?.id || null, {});

    return data;
  }

  static async updateCampaign(campaignId: string, updates: Partial<Campaign>): Promise<Campaign> {
    const { data: userData } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('campaigns')
      .update(updates)
      .eq('id', campaignId)
      .select()
      .single();

    if (error) throw new Error(error.message);

    await this.logAuditAction(campaignId, 'edited', userData?.user?.id || null, updates);

    return data;
  }

  static async deleteCampaign(campaignId: string): Promise<void> {
    const { error } = await supabase
      .from('campaigns')
      .delete()
      .eq('id', campaignId);

    if (error) throw new Error(error.message);
  }

  static async calculateAudienceSize(
    restaurantId: string,
    audienceType: string,
    audienceFilter: Record<string, any>
  ): Promise<number> {
    const { data, error } = await supabase
      .rpc('calculate_campaign_audience', {
        p_restaurant_id: restaurantId,
        p_audience_type: audienceType,
        p_audience_filter: audienceFilter,
      });

    if (error) throw new Error(error.message);
    return data || 0;
  }

  static async getCampaignMessages(campaignId: string): Promise<CampaignMessage[]> {
    const { data, error } = await supabase
      .from('campaign_messages')
      .select('*')
      .eq('campaign_id', campaignId);

    if (error) throw new Error(error.message);
    return data || [];
  }

  static async createCampaignMessage(message: Partial<CampaignMessage>): Promise<CampaignMessage> {
    const { data, error } = await supabase
      .from('campaign_messages')
      .insert(message)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  static async updateCampaignMessage(
    messageId: string,
    updates: Partial<CampaignMessage>
  ): Promise<CampaignMessage> {
    const { data, error } = await supabase
      .from('campaign_messages')
      .update(updates)
      .eq('id', messageId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  static async generatePromoCode(
    restaurantId: string,
    prefix: string = 'PROMO'
  ): Promise<string> {
    const { data, error } = await supabase
      .rpc('generate_promo_code', {
        p_restaurant_id: restaurantId,
        p_prefix: prefix,
      });

    if (error) throw new Error(error.message);
    return data;
  }

  static async createPromoCode(promoCode: Partial<PromoCode>): Promise<PromoCode> {
    const { data, error } = await supabase
      .from('promo_codes')
      .insert(promoCode)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  static async getPromoCodes(restaurantId: string): Promise<PromoCode[]> {
    const { data, error } = await supabase
      .from('promo_codes')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
  }

  static async validatePromoCode(
    restaurantId: string,
    customerId: string,
    code: string,
    orderAmount: number
  ): Promise<any> {
    const { data, error } = await supabase
      .rpc('validate_promo_code', {
        p_restaurant_id: restaurantId,
        p_customer_id: customerId,
        p_code: code,
        p_order_amount: orderAmount,
      });

    if (error) throw new Error(error.message);
    return data;
  }

  static async redeemPromoCode(
    promoCodeId: string,
    customerId: string,
    restaurantId: string,
    orderAmount: number,
    discountApplied: number
  ): Promise<string> {
    const { data, error } = await supabase
      .rpc('redeem_promo_code', {
        p_promo_code_id: promoCodeId,
        p_customer_id: customerId,
        p_restaurant_id: restaurantId,
        p_order_amount: orderAmount,
        p_discount_applied: discountApplied,
      });

    if (error) throw new Error(error.message);
    return data;
  }

  static async getCampaignMetrics(campaignId: string): Promise<CampaignMetrics | null> {
    const { data, error } = await supabase
      .from('campaign_metrics')
      .select('*')
      .eq('campaign_id', campaignId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data;
  }

  static async updateCampaignMetrics(campaignId: string): Promise<void> {
    const { error } = await supabase
      .rpc('update_campaign_metrics_for_campaign', {
        p_campaign_id: campaignId,
      });

    if (error) throw new Error(error.message);
  }

  static async getAllTags(restaurantId: string): Promise<CustomerTag[]> {
    const { data, error } = await supabase
      .from('customer_tags')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('name');

    if (error) throw new Error(error.message);
    return data || [];
  }

  static async createCustomerTag(tag: Partial<CustomerTag>): Promise<CustomerTag> {
    const { data, error } = await supabase
      .from('customer_tags')
      .insert(tag)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  static async assignTagToCustomer(customerId: string, tagId: string): Promise<void> {
    const { error } = await supabase
      .from('customer_tag_assignments')
      .insert({
        customer_id: customerId,
        tag_id: tagId,
      });

    if (error) throw new Error(error.message);
  }

  static async removeTagFromCustomer(customerId: string, tagId: string): Promise<void> {
    const { error } = await supabase
      .from('customer_tag_assignments')
      .delete()
      .eq('customer_id', customerId)
      .eq('tag_id', tagId);

    if (error) throw new Error(error.message);
  }

  static async getCustomerTags(customerId: string): Promise<CustomerTag[]> {
    const { data, error } = await supabase
      .from('customer_tag_assignments')
      .select('customer_tags(*)')
      .eq('customer_id', customerId);

    if (error) throw new Error(error.message);
    return data?.map((item: any) => item.customer_tags) || [];
  }

  static async getCustomerConsent(customerId: string, restaurantId: string): Promise<CustomerConsent | null> {
    const { data, error } = await supabase
      .from('customer_consent')
      .select('*')
      .eq('customer_id', customerId)
      .eq('restaurant_id', restaurantId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data;
  }

  static async updateCustomerConsent(
    customerId: string,
    restaurantId: string,
    consent: Partial<CustomerConsent>
  ): Promise<CustomerConsent> {
    const { data, error } = await supabase
      .from('customer_consent')
      .upsert({
        customer_id: customerId,
        restaurant_id: restaurantId,
        ...consent,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  static async scheduleCampaign(campaignId: string, scheduledAt: string): Promise<Campaign> {
    const { data: userData } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('campaigns')
      .update({
        status: 'scheduled',
        scheduled_at: scheduledAt,
      })
      .eq('id', campaignId)
      .select()
      .single();

    if (error) throw new Error(error.message);

    await this.logAuditAction(campaignId, 'scheduled', userData?.user?.id || null, { scheduled_at: scheduledAt });

    return data;
  }

  static async cancelCampaign(campaignId: string): Promise<Campaign> {
    const { data: userData } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('campaigns')
      .update({ status: 'cancelled' })
      .eq('id', campaignId)
      .select()
      .single();

    if (error) throw new Error(error.message);

    await this.logAuditAction(campaignId, 'cancelled', userData?.user?.id || null, {});

    return data;
  }

  static async pauseCampaign(campaignId: string): Promise<Campaign> {
    const { data: userData } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('campaigns')
      .update({ status: 'paused' })
      .eq('id', campaignId)
      .select()
      .single();

    if (error) throw new Error(error.message);

    await this.logAuditAction(campaignId, 'paused', userData?.user?.id || null, {});

    return data;
  }

  static async resumeCampaign(campaignId: string): Promise<Campaign> {
    const { data: userData } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('campaigns')
      .update({ status: 'scheduled' })
      .eq('id', campaignId)
      .select()
      .single();

    if (error) throw new Error(error.message);

    await this.logAuditAction(campaignId, 'resumed', userData?.user?.id || null, {});

    return data;
  }

  static async getCampaignAuditLog(campaignId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('campaign_audit_log')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('timestamp', { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
  }

  private static async logAuditAction(
    campaignId: string,
    action: string,
    performedBy: string | null,
    changes: Record<string, any>
  ): Promise<void> {
    await supabase
      .from('campaign_audit_log')
      .insert({
        campaign_id: campaignId,
        action,
        performed_by: performedBy,
        changes,
      });
  }

  static async previewCampaign(campaignId: string, customerId: string): Promise<any> {
    const campaign = await this.getCampaign(campaignId);
    const messages = await this.getCampaignMessages(campaignId);

    if (!campaign || messages.length === 0) {
      throw new Error('Campaign or messages not found');
    }

    const { data: customer } = await supabase
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .single();

    if (!customer) {
      throw new Error('Customer not found');
    }

    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('*')
      .eq('id', campaign.restaurant_id)
      .single();

    const renderedMessages = messages.map(msg => {
      let rendered = msg.message_template;

      rendered = rendered.replace(/\{\{customer_name\}\}/g, `${customer.first_name} ${customer.last_name}`);
      rendered = rendered.replace(/\{\{restaurant_name\}\}/g, restaurant?.name || '');
      rendered = rendered.replace(/\{\{promo_code\}\}/g, 'PREVIEW-CODE');

      return {
        ...msg,
        rendered_message: rendered,
      };
    });

    const { data: userData } = await supabase.auth.getUser();
    await this.logAuditAction(campaignId, 'preview', userData?.user?.id || null, { customer_id: customerId });

    return {
      campaign,
      messages: renderedMessages,
      customer,
    };
  }
}
