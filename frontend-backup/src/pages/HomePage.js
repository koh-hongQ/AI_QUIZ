import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Button,
  Heading,
  Text,
  Stack,
  SimpleGrid,
  Icon,
  Flex,
  Container
} from '@chakra-ui/react';
import { 
  FaFileUpload, 
  FaQuestionCircle, 
  FaBrain, 
  FaClipboardCheck 
} from 'react-icons/fa';

const FeatureCard = ({ icon, title, description }) => {
  return (
    <Box
      p={6}
      borderWidth="1px"
      borderRadius="lg"
      boxShadow="md"
      transition="all 0.3s"
      _hover={{ transform: 'translateY(-5px)', boxShadow: 'lg' }}
    >
      <Flex
        rounded="full"
        w={12}
        h={12}
        bg="teal.500"
        align="center"
        justify="center"
        color="white"
        mb={4}
      >
        <Icon as={icon} fontSize="xl" />
      </Flex>
      <Heading as="h3" size="md" mb={2}>
        {title}
      </Heading>
      <Text color="gray.600">{description}</Text>
    </Box>
  );
};

const HomePage = () => {
  return (
    <Container maxW="container.xl">
      <Box textAlign="center" py={12}>
        <Heading as="h1" size="2xl" mb={4}>
          AI-Powered Quiz Generator
        </Heading>
        <Text fontSize="xl" maxW="3xl" mx="auto" mb={10} color="gray.600">
          Transform your PDF lecture materials into interactive quizzes in seconds. 
          Powered by state-of-the-art LLM and RAG technology.
        </Text>
        
        <Stack
          direction={{ base: 'column', md: 'row' }}
          spacing={4}
          justify="center"
          mb={16}
        >
          <Button
            as={RouterLink}
            to="/upload"
            size="lg"
            colorScheme="teal"
            leftIcon={<FaFileUpload />}
            px={8}
          >
            Upload PDF
          </Button>
          <Button
            as={RouterLink}
            to="/saved-quizzes"
            size="lg"
            colorScheme="blue"
            variant="outline"
            leftIcon={<FaClipboardCheck />}
            px={8}
          >
            My Quizzes
          </Button>
        </Stack>
        
        <Heading as="h2" size="lg" mb={8}>
          How It Works
        </Heading>
        
        <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={10} mb={16}>
          <FeatureCard
            icon={FaFileUpload}
            title="Upload PDF"
            description="Upload your lecture materials, research papers, or any educational PDF document."
          />
          <FeatureCard
            icon={FaBrain}
            title="AI Processing"
            description="Our system extracts, cleans, and processes the content using advanced NLP techniques."
          />
          <FeatureCard
            icon={FaQuestionCircle}
            title="Quiz Generation"
            description="Choose quiz type and let AI generate relevant multiple choice, true/false, or short answer questions."
          />
          <FeatureCard
            icon={FaClipboardCheck}
            title="Test & Learn"
            description="Take the quiz, check your answers, and enhance your learning through testing."
          />
        </SimpleGrid>
        
        <Box p={8} bg="gray.50" borderRadius="lg">
          <Heading as="h3" size="md" mb={4}>
            Ready to enhance your learning?
          </Heading>
          <Text mb={6}>
            Start by uploading a PDF lecture document and let our AI handle the rest.
          </Text>
          <Button
            as={RouterLink}
            to="/upload"
            colorScheme="teal"
            size="lg"
          >
            Get Started
          </Button>
        </Box>
      </Box>
    </Container>
  );
};

export default HomePage;