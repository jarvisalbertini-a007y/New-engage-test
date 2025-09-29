import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Plus, Search, Download, Upload, Filter, MoreHorizontal, Mail, Phone, Linkedin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import LeadFilters from "@/components/lead-filters";
import { useToast } from "@/hooks/use-toast";

export default function LeadDatabase() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState({
    industry: "",
    size: "",
    location: "",
    technologies: [],
  });
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: companies, isLoading: companiesLoading } = useQuery({
    queryKey: ["/api/companies"],
    queryFn: () => api.getCompanies(100),
  });

  const { data: contacts, isLoading: contactsLoading } = useQuery({
    queryKey: ["/api/contacts"],
    queryFn: () => api.getContacts({ limit: 100 }),
  });

  const createContactMutation = useMutation({
    mutationFn: api.createContact,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      toast({
        title: "Contact Added",
        description: "New contact has been added to your database.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add contact. Please try again.",
        variant: "destructive",
      });
    },
  });

  const filteredCompanies = companies?.filter((company: any) => {
    const matchesSearch = company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         company.domain?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesIndustry = !filters.industry || company.industry === filters.industry;
    const matchesSize = !filters.size || company.size === filters.size;
    const matchesLocation = !filters.location || company.location?.includes(filters.location);
    
    return matchesSearch && matchesIndustry && matchesSize && matchesLocation;
  });

  const getContactsForCompany = (companyId: string) => {
    return contacts?.filter((contact: any) => contact.companyId === companyId) || [];
  };

  const handleAddToSequence = (contactId: string) => {
    toast({
      title: "Added to Sequence",
      description: "Contact has been added to your sequence.",
    });
  };

  const exportData = () => {
    const csvData = filteredCompanies?.map((company: any) => ({
      Company: company.name,
      Domain: company.domain,
      Industry: company.industry,
      Size: company.size,
      Location: company.location,
      Revenue: company.revenue,
    }));
    
    // In a real app, this would generate and download a CSV file
    toast({
      title: "Export Started",
      description: "Your data export has been initiated.",
    });
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-card border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Lead Database</h1>
            <p className="text-muted-foreground">Manage your prospects and company data</p>
          </div>
          <div className="flex items-center space-x-4">
            <Button variant="outline" onClick={exportData} data-testid="button-export">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button variant="outline" data-testid="button-import">
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Button>
            <Button data-testid="button-add-contact">
              <Plus className="h-4 w-4 mr-2" />
              Add Contact
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-6 space-y-6">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Companies</p>
                  <p className="text-3xl font-bold" data-testid="text-total-companies">
                    {companies?.length || 0}
                  </p>
                </div>
                <Badge variant="secondary">Companies</Badge>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Contacts</p>
                  <p className="text-3xl font-bold text-chart-1" data-testid="text-total-contacts">
                    {contacts?.length || 0}
                  </p>
                </div>
                <Badge className="bg-chart-1 text-background">Contacts</Badge>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Verified Emails</p>
                  <p className="text-3xl font-bold text-chart-2" data-testid="text-verified-emails">
                    {contacts?.filter((c: any) => c.isVerified).length || 0}
                  </p>
                </div>
                <Badge className="bg-chart-2 text-background">Verified</Badge>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Industries</p>
                  <p className="text-3xl font-bold text-chart-3" data-testid="text-industries">
                    {new Set(companies?.map((c: any) => c.industry).filter(Boolean)).size || 0}
                  </p>
                </div>
                <Badge className="bg-chart-3 text-background">Industries</Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Search & Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Search companies, domains, or contacts..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                    data-testid="input-search"
                  />
                </div>
              </div>
              <Dialog open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" data-testid="button-filters">
                    <Filter className="h-4 w-4 mr-2" />
                    Filters
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Filter Leads</DialogTitle>
                  </DialogHeader>
                  <LeadFilters
                    filters={filters}
                    onFiltersChange={setFilters}
                    companies={companies || []}
                  />
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>

        {/* Companies Table */}
        <Card>
          <CardHeader>
            <CardTitle>Companies ({filteredCompanies?.length || 0})</CardTitle>
          </CardHeader>
          <CardContent>
            {companiesLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading companies...</div>
            ) : filteredCompanies?.length ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Company</TableHead>
                      <TableHead>Industry</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Contacts</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCompanies.map((company: any) => {
                      const companyContacts = getContactsForCompany(company.id);
                      return (
                        <TableRow key={company.id}>
                          <TableCell className="font-medium">
                            <div>
                              <p className="font-semibold" data-testid={`text-company-${company.id}`}>
                                {company.name}
                              </p>
                              {company.domain && (
                                <p className="text-sm text-muted-foreground">{company.domain}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {company.industry && (
                              <Badge variant="secondary">{company.industry}</Badge>
                            )}
                          </TableCell>
                          <TableCell>{company.size || "Unknown"}</TableCell>
                          <TableCell>{company.location || "Unknown"}</TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <span className="font-medium">{companyContacts.length}</span>
                              {companyContacts.slice(0, 3).map((contact: any) => (
                                <Avatar key={contact.id} className="h-6 w-6">
                                  <AvatarFallback className="text-xs">
                                    {getInitials(contact.firstName, contact.lastName)}
                                  </AvatarFallback>
                                </Avatar>
                              ))}
                              {companyContacts.length > 3 && (
                                <span className="text-xs text-muted-foreground">
                                  +{companyContacts.length - 3}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0" data-testid={`button-actions-${company.id}`}>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem>
                                  <Mail className="h-4 w-4 mr-2" />
                                  Add to Sequence
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  <Plus className="h-4 w-4 mr-2" />
                                  Add Contact
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  View Details
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="mx-auto w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-4">
                  <Search className="h-12 w-12 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-2">No companies found</h3>
                <p className="text-muted-foreground">
                  Try adjusting your search terms or filters
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Contacts Table */}
        <Card>
          <CardHeader>
            <CardTitle>Contacts ({contacts?.length || 0})</CardTitle>
          </CardHeader>
          <CardContent>
            {contactsLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading contacts...</div>
            ) : contacts?.length ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Contact</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contacts.slice(0, 20).map((contact: any) => {
                      const company = companies?.find((c: any) => c.id === contact.companyId);
                      return (
                        <TableRow key={contact.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center space-x-3">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback>
                                  {getInitials(contact.firstName, contact.lastName)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-semibold" data-testid={`text-contact-${contact.id}`}>
                                  {contact.firstName} {contact.lastName}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{company?.name || "Unknown"}</TableCell>
                          <TableCell>{contact.title || "Unknown"}</TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <span>{contact.email}</span>
                              {contact.isVerified && (
                                <Badge variant="secondary" className="text-xs">Verified</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">Active</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleAddToSequence(contact.id)}
                                data-testid={`button-add-sequence-${contact.id}`}
                              >
                                <Mail className="h-3 w-3 mr-1" />
                                Add to Sequence
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" className="h-8 w-8 p-0" data-testid={`button-contact-actions-${contact.id}`}>
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem>
                                    <Phone className="h-4 w-4 mr-2" />
                                    Call
                                  </DropdownMenuItem>
                                  <DropdownMenuItem>
                                    <Linkedin className="h-4 w-4 mr-2" />
                                    LinkedIn
                                  </DropdownMenuItem>
                                  <DropdownMenuItem>
                                    Edit Contact
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="mx-auto w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-4">
                  <Plus className="h-12 w-12 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-2">No contacts found</h3>
                <p className="text-muted-foreground mb-4">
                  Start building your database by adding contacts
                </p>
                <Button data-testid="button-add-first-contact">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Contact
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
