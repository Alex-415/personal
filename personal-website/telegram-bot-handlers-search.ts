export async function searchWeb(query: string): Promise<string> {
  try {
    // Using DuckDuckGo search via their instant answer API
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1`;

    const response = await fetch(url);
    if (!response.ok) {
      return '';
    }

    const data = await response.json() as any;

    // Extract relevant results
    let results = '';

    // Add abstract if available
    if (data.AbstractText) {
      results += `Summary: ${data.AbstractText}\n`;
    }

    // Add related topics (up to 3)
    if (data.RelatedTopics && data.RelatedTopics.length > 0) {
      results += '\nRelated information:\n';
      data.RelatedTopics.slice(0, 3).forEach((topic: any) => {
        if (topic.Text) {
          results += `- ${topic.Text}\n`;
        }
      });
    }

    return results || 'No search results found.';
  } catch (error) {
    console.error('Search error:', error);
    return '';
  }
}
