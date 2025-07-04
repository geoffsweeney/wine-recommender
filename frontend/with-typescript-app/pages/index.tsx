import Layout from "../components/Layout";
import Chatbot from "../components/Chatbot"; // Import the Chatbot component
import { Box } from "@chakra-ui/react"; // Import Box for layout

const IndexPage = () => (
  <Layout title="Chatbot UI | Next.js + Chakra UI Example">
    <Box p={4}> {/* Use Box for layout and add some padding */}
      <Chatbot />
    </Box>
  </Layout>
);

export default IndexPage;
