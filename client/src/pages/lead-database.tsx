import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  Building2, User, Search, Plus, Mail, Phone, Briefcase, 
  MapPin, DollarSign, Users, ExternalLink, Sparkles, Filter 
} from "lucide-react";

const companyFormSchema = z.object({
  name: z.string().min(1, "Company name is required"),
  domain: z.string().optional(),
  industry: z.string().optional(),
  size: z.string().optional(),
  location: z.string().optional(),
  revenue: z.string().optional(),
  description: z.string().optional(),
  linkedinUrl: z.string().optional(),
});

const contactFormSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Valid email required"),
  companyId: z.string().optional(),
  title: z.string().optional(),
  phoneNumber: z.string().optional(),
  linkedinUrl: z.string().optional(),
});

type CompanyFormData = z.infer<typeof companyFormSchema>;
type ContactFormData = z.infer<typeof contactFormSchema>;

export default function Leads() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [companyDialogOpen, setCompanyDialogOpen] = useState(false);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [filterIndustry, setFilterIndustry] = useState<string>("all");
  const [filterSize, setFilterSize] = useState<string>("all");

  // Queries
  const { data: companies = [], isLoading: companiesLoading } = useQuery({
    queryKey: ["/api/companies"],
  });

  const { data: contacts = [], isLoading: contactsLoading } = useQuery({
    queryKey: ["/api/contacts"],
  });

  // Forms
  const companyForm = useForm<CompanyFormData>({
    resolver: zodResolver(companyFormSchema),
    defaultValues: {
      name: "",
      domain: "",
      industry: "",
      size: "",
      location: "",
      revenue: "",
      description: "",
      linkedinUrl: "",
    },
  });

  const contactForm = useForm<ContactFormData>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      companyId: "",
      title: "",
      phoneNumber: "",
      linkedinUrl: "",
    },
  });

  // Mutations
  const createCompanyMutation = useMutation({
    mutationFn: async (data: CompanyFormData) => {
      const response = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create company");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Company Created",
        description: "Successfully added new company to database",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      setCompanyDialogOpen(false);
      companyForm.reset();
    },
  });

  const createContactMutation = useMutation({
    mutationFn: async (data: ContactFormData) => {
      const response = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create contact");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Contact Created",
        description: "Successfully added new contact to database",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      setContactDialogOpen(false);
      contactForm.reset();
    },
  });

  const enrichCompanyMutation = useMutation({
    mutationFn: async (companyId: string) => {
      const response = await fetch(`/api/companies/${companyId}/enrich`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to enrich company");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Enrichment Started",
        description: "Company data is being enriched with external sources",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
    },
  });

  // Filters
  const filteredCompanies = companies.filter((company: any) => {
    const matchesSearch = company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      company.domain?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesIndustry = filterIndustry === "all" || company.industry === filterIndustry;
    const matchesSize = filterSize === "all" || company.size === filterSize;
    return matchesSearch && matchesIndustry && matchesSize;
  });

  const filteredContacts = contacts.filter((contact: any) => {
    const fullName = `${contact.firstName} ${contact.lastName}`.toLowerCase();
    return fullName.includes(searchTerm.toLowerCase()) ||
      contact.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.title?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const industries = Array.from(new Set(companies.map((c: any) => c.industry).filter(Boolean)));
  const sizes = Array.from(new Set(companies.map((c: any) => c.size).filter(Boolean)));

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Lead Database</h1>
            <p className="text-muted-foreground mt-1">
              Manage companies and contacts with enrichment
            </p>
          </div>
          <div className="flex gap-2">
            <Dialog open={companyDialogOpen} onOpenChange={setCompanyDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-company">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Company
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Add New Company</DialogTitle>
                </DialogHeader>
                <Form {...companyForm}>
                  <form onSubmit={companyForm.handleSubmit((data) => createCompanyMutation.mutate(data))} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={companyForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Company Name*</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-company-name" placeholder="Acme Corp" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={companyForm.control}
                        name="domain"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Domain</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-company-domain" placeholder="acme.com" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={companyForm.control}
                        name="industry"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Industry</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-company-industry" placeholder="Technology" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={companyForm.control}
                        name="size"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Company Size</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-company-size">
                                  <SelectValue placeholder="Select size" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="1-10">1-10</SelectItem>
                                <SelectItem value="11-50">11-50</SelectItem>
                                <SelectItem value="51-200">51-200</SelectItem>
                                <SelectItem value="201-500">201-500</SelectItem>
                                <SelectItem value="501-1000">501-1000</SelectItem>
                                <SelectItem value="1000+">1000+</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={companyForm.control}
                        name="location"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Location</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-company-location" placeholder="San Francisco, CA" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={companyForm.control}
                        name="revenue"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Revenue</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-company-revenue" placeholder="$10M-$50M" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={companyForm.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-company-description" placeholder="Brief company description" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={companyForm.control}
                      name="linkedinUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>LinkedIn URL</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-company-linkedin" placeholder="https://linkedin.com/company/..." />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setCompanyDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" data-testid="button-submit-company" disabled={createCompanyMutation.isPending}>
                        {createCompanyMutation.isPending ? "Creating..." : "Create Company"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>

            <Dialog open={contactDialogOpen} onOpenChange={setContactDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" data-testid="button-add-contact">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Contact
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Contact</DialogTitle>
                </DialogHeader>
                <Form {...contactForm}>
                  <form onSubmit={contactForm.handleSubmit((data) => createContactMutation.mutate(data))} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={contactForm.control}
                        name="firstName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>First Name*</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-contact-firstname" placeholder="John" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={contactForm.control}
                        name="lastName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Last Name*</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-contact-lastname" placeholder="Doe" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={contactForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email*</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-contact-email" type="email" placeholder="john@company.com" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={contactForm.control}
                      name="companyId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Company</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-contact-company">
                                <SelectValue placeholder="Select company" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {companies.map((company: any) => (
                                <SelectItem key={company.id} value={company.id}>
                                  {company.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={contactForm.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Title</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-contact-title" placeholder="VP of Sales" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={contactForm.control}
                      name="phoneNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-contact-phone" placeholder="+1 (555) 123-4567" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={contactForm.control}
                      name="linkedinUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>LinkedIn URL</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-contact-linkedin" placeholder="https://linkedin.com/in/..." />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setContactDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" data-testid="button-submit-contact" disabled={createContactMutation.isPending}>
                        {createContactMutation.isPending ? "Creating..." : "Create Contact"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Companies</p>
                <p className="text-2xl font-bold" data-testid="text-total-companies">{companies.length}</p>
              </div>
              <Building2 className="h-8 w-8 text-primary" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Contacts</p>
                <p className="text-2xl font-bold" data-testid="text-total-contacts">{contacts.length}</p>
              </div>
              <Users className="h-8 w-8 text-primary" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Verified Contacts</p>
                <p className="text-2xl font-bold">{contacts.filter((c: any) => c.isVerified).length}</p>
              </div>
              <Mail className="h-8 w-8 text-green-500" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Industries</p>
                <p className="text-2xl font-bold">{industries.length}</p>
              </div>
              <Briefcase className="h-8 w-8 text-purple-500" />
            </div>
          </Card>
        </div>

        {/* Search and Filters */}
        <Card className="p-4">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search companies, contacts, domains..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="input-search-leads"
              />
            </div>
            <Select value={filterIndustry} onValueChange={setFilterIndustry}>
              <SelectTrigger className="w-48" data-testid="select-filter-industry">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="All Industries" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Industries</SelectItem>
                {industries.map((industry: string) => (
                  <SelectItem key={industry} value={industry}>
                    {industry}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterSize} onValueChange={setFilterSize}>
              <SelectTrigger className="w-48" data-testid="select-filter-size">
                <Users className="h-4 w-4 mr-2" />
                <SelectValue placeholder="All Sizes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sizes</SelectItem>
                {sizes.map((size: string) => (
                  <SelectItem key={size} value={size}>
                    {size} employees
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="companies" className="space-y-4">
          <TabsList>
            <TabsTrigger value="companies" data-testid="tab-companies">
              <Building2 className="h-4 w-4 mr-2" />
              Companies ({filteredCompanies.length})
            </TabsTrigger>
            <TabsTrigger value="contacts" data-testid="tab-contacts">
              <User className="h-4 w-4 mr-2" />
              Contacts ({filteredContacts.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="companies" className="space-y-4">
            {companiesLoading ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">Loading companies...</p>
              </Card>
            ) : filteredCompanies.length === 0 ? (
              <Card className="p-8 text-center">
                <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No companies found</p>
              </Card>
            ) : (
              <div className="grid gap-4">
                {filteredCompanies.map((company: any) => (
                  <Card key={company.id} className="p-6" data-testid={`card-company-${company.id}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold" data-testid={`text-company-name-${company.id}`}>
                            {company.name}
                          </h3>
                          {company.domain && (
                            <a
                              href={`https://${company.domain}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-primary hover:underline flex items-center"
                              data-testid={`link-company-domain-${company.id}`}
                            >
                              {company.domain}
                              <ExternalLink className="h-3 w-3 ml-1" />
                            </a>
                          )}
                          {company.technologies?.length > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              {company.technologies.length} technologies
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-4">{company.description || "No description"}</p>
                        <div className="flex flex-wrap gap-4 text-sm">
                          {company.industry && (
                            <div className="flex items-center gap-1">
                              <Briefcase className="h-4 w-4 text-muted-foreground" />
                              <span>{company.industry}</span>
                            </div>
                          )}
                          {company.size && (
                            <div className="flex items-center gap-1">
                              <Users className="h-4 w-4 text-muted-foreground" />
                              <span>{company.size} employees</span>
                            </div>
                          )}
                          {company.location && (
                            <div className="flex items-center gap-1">
                              <MapPin className="h-4 w-4 text-muted-foreground" />
                              <span>{company.location}</span>
                            </div>
                          )}
                          {company.revenue && (
                            <div className="flex items-center gap-1">
                              <DollarSign className="h-4 w-4 text-muted-foreground" />
                              <span>{company.revenue}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => enrichCompanyMutation.mutate(company.id)}
                        disabled={enrichCompanyMutation.isPending}
                        data-testid={`button-enrich-${company.id}`}
                      >
                        <Sparkles className="h-4 w-4 mr-2" />
                        Enrich
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="contacts" className="space-y-4">
            {contactsLoading ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">Loading contacts...</p>
              </Card>
            ) : filteredContacts.length === 0 ? (
              <Card className="p-8 text-center">
                <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No contacts found</p>
              </Card>
            ) : (
              <div className="grid gap-4">
                {filteredContacts.map((contact: any) => {
                  const company = companies.find((c: any) => c.id === contact.companyId);
                  return (
                    <Card key={contact.id} className="p-6" data-testid={`card-contact-${contact.id}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex gap-4">
                          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="h-6 w-6 text-primary" />
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold" data-testid={`text-contact-name-${contact.id}`}>
                              {contact.firstName} {contact.lastName}
                              {contact.isVerified && (
                                <Badge variant="secondary" className="ml-2">Verified</Badge>
                              )}
                            </h3>
                            {contact.title && (
                              <p className="text-sm text-muted-foreground">{contact.title}</p>
                            )}
                            {company && (
                              <p className="text-sm text-muted-foreground">{company.name}</p>
                            )}
                            <div className="flex gap-4 mt-3 text-sm">
                              {contact.email && (
                                <a href={`mailto:${contact.email}`} className="flex items-center gap-1 text-primary hover:underline" data-testid={`link-contact-email-${contact.id}`}>
                                  <Mail className="h-4 w-4" />
                                  {contact.email}
                                </a>
                              )}
                              {contact.phoneNumber && (
                                <div className="flex items-center gap-1">
                                  <Phone className="h-4 w-4 text-muted-foreground" />
                                  {contact.phoneNumber}
                                </div>
                              )}
                              {contact.linkedinUrl && (
                                <a
                                  href={contact.linkedinUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-primary hover:underline"
                                  data-testid={`link-contact-linkedin-${contact.id}`}
                                >
                                  LinkedIn
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" data-testid={`button-email-${contact.id}`}>
                            <Mail className="h-4 w-4 mr-2" />
                            Email
                          </Button>
                          <Button variant="outline" size="sm" data-testid={`button-call-${contact.id}`}>
                            <Phone className="h-4 w-4 mr-2" />
                            Call
                          </Button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
